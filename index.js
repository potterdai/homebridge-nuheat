"use strict";
let NuHeatAPI = require("./lib/api");
let NuHeatThermostat = require("./lib/NuHeatThermostat");
const logger = require("./lib/logger");
let Homebridge, PlatformAccessory, Service, Characteristic, UUIDGen;
module.exports = function (homebridge) {
    Homebridge = homebridge;
    PlatformAccessory = homebridge.platformAccessory;
    Characteristic = homebridge.hap.Characteristic;
    Service = homebridge.hap.Service;
    UUIDGen = homebridge.hap.uuid;
    homebridge.registerPlatform("homebridge-nuheat", "NuHeat", NuHeatPlatform, true);
};

class NuHeatPlatform {
    constructor(log, config, api) {
        if (!config) {
            log.warn("Ignoring NuHeat Platform setup because it is not configured");
            this.disabled = true;
            return;
        }
        if ((!config.Email && !config.email) || !config.password) {
            log.warn("Ignoring NuHeat Platform setup because it is not configured properly. Missing email or password");
            this.disabled = true;
            return;
        }

        this.config = config;
        this.config.email = this.config.Email || this.config.email;
        this.config.holdLength = Math.min(1440, Math.max(0, this.config.holdLength || 1440));
        this.api = api;
        this.accessories = [];
        this.log = new logger.Logger(log, this.config.debug || false);
        this.setupPlatform();
    }
    configureAccessory(accessory) {
        this.accessories.push({ uuid: accessory.UUID, accessory: accessory });
    }
    async setupPlatform() {
        this.log.info("Logging into NuHeat...");
        this.NuHeatAPI = new NuHeatAPI(this.log, this.config.email, this.config.password);
        await this.NuHeatAPI.authenticate();
        await this.setupThermostats();
        this.cleanupRemovedAccessories();
        setInterval(this.refreshAccessories.bind(this), (this.config.refresh || 60) * 1000);
    }

    async setupThermostats() {
        let deviceArray = this.config.devices || [];
        if (deviceArray.length == 0) {
            this.log.info(
                "No devices defined in config. Auto populating thermostats by pulling everything from the account."
            );
        }
        await Promise.all(
            deviceArray.map(async (device) => {
                if (!device.disabled) {
                    var uuid = UUIDGen.generate(device.serialNumber.toString());
                    let deviceAccessory = false;
                    if (this.accessories.find((accessory) => accessory.uuid === uuid)) {
                        deviceAccessory = this.accessories.find((accessory) => accessory.uuid === uuid).accessory;
                    }

                    if (!deviceAccessory) {
                        this.log.info("Creating new thermostat for serial number: " + device.serialNumber);
                        let accessory = new PlatformAccessory(device.serialNumber, uuid);
                        accessory.addService(Service.Thermostat, device.serialNumber);
                        this.api.registerPlatformAccessories("homebridge-nuheat", "NuHeat", [accessory]);
                        deviceAccessory = accessory;
                        this.accessories.push({ uuid: uuid });
                    }

                    const thermostat = new NuHeatThermostat(
                        this.log,
                        device.serialNumber,
                        deviceAccessory instanceof NuHeatThermostat ? deviceAccessory.accessory : deviceAccessory,
                        this.NuHeatAPI,
                        Homebridge
                    );
                    await thermostat.updateAccessory();

                    this.accessories.find((accessory) => accessory.uuid === uuid).accessory = thermostat;
                    this.accessories.find((accessory) => accessory.uuid === uuid).existsInConfig = true;
                    this.log.info("Loaded thermostat " + thermostat.thermostat.name + device.serialNumber);
                }
            })
        );
    }

    cleanupRemovedAccessories() {
        // Iterate over all accessories in the dictionary, and anything without the flag needs to be removed
        this.accessories.forEach(function (thisAccessory) {
            if (thisAccessory.existsInConfig !== true) {
                try {
                    this.log.info(
                        "Deleting removed accessory",
                        thisAccessory.accessory
                            .getService(Service.AccessoryInformation)
                            .getCharacteristic(Characteristic.Name)
                            .getValue()
                    );
                } catch {
                    this.log.info("Deleting removed accessory");
                }
                this.api.unregisterPlatformAccessories(undefined, undefined, [thisAccessory.accessory]);
            }
        }, this);
    }

    refreshAccessories() {
        this.refreshTheromstats();
    }

    async refreshTheromstats() {
        this.log.debug("Trying to refresh thermostats.");
        for (let i = 0; i < this.accessories.length; i++) {
            let thisAccessory = this.accessories[i];
            if (thisAccessory.accessory instanceof NuHeatThermostat) {
                this.log.debug("Refreshing thermostat " + thisAccessory.accessory.thermostat.name);
                await thisAccessory.accessory.updateAccessory();
            }
        }
    }
}
