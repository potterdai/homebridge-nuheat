let Characteristic, ThermostatService;
module.exports = class NuHeatThermostat {
    constructor(log, serialNumber, accessory, NuHeatAPI, homebridge) {
        Characteristic = homebridge.hap.Characteristic;
        ThermostatService = homebridge.hap.Service.Thermostat;
        this.log = log;
        this.accessory = accessory;
        this.serialNumber = serialNumber;
        this.thermostat = NuHeatAPI.getThermostat(serialNumber);

        this.accessory
            .getService(homebridge.hap.Service.AccessoryInformation)
            .setCharacteristic(Characteristic.Manufacturer, "NuHeat")
            .setCharacteristic(Characteristic.Model, "Signature")
            .setCharacteristic(Characteristic.SerialNumber, serialNumber)
            .setCharacteristic(Characteristic.FirmwareRevision, "0");
        this.setupListeners();
    }

    setupListeners() {
        // this.addCharacteristic(Characteristic.TargetHeatingCoolingState); READ WRITE
        this.accessory
            .getService(ThermostatService)
            .getCharacteristic(Characteristic.TargetHeatingCoolingState)
            .setProps({
                validValues: [0, 1],
            })
            .on("set", this.setTargetHeatingCooling.bind(this));
        // this.addCharacteristic(Characteristic.CurrentTemperature); READ
        this.accessory.getService(ThermostatService).getCharacteristic(Characteristic.CurrentTemperature).setProps({
            minValue: -100,
            maxValue: 100,
        });
        // this.addCharacteristic(Characteristic.TargetTemperature); READ WRITE
        this.accessory
            .getService(ThermostatService)
            .getCharacteristic(Characteristic.TargetTemperature)
            .setProps({
                minStep: 0.5,
            })
            .on("set", this.setTargetTemperature.bind(this));
    }

    // This is to change the system switch to a different mode - that doesn't work for us, its always in heat
    setTargetHeatingCooling(value, callback) {
        callback(null);
        this.updateAccessory();
    }

    // This is change the setpoint
    async setTargetTemperature(value, callback) {
        // maxValue = 38,
        // minValue = 10,
        this.log.info("Setting target temperature to " + value + "°C", this.serialNumber);
        if (value < 10) value = 10;
        if (value > 38) value = 38;
        let heatSetPoint = this.toNuHeatTemperature(value);
        this.log.debug("setTargetTemperature " + heatSetPoint, this.serialNumber);

        await this.api.setTargetTemperature(heatSetPoint);
        await this.updateAccessory();
        callback(null);
    }

    async updateAccessory() {
        await this.api.getData();
        if (!response) {
            this.log.error("Error getting updated data", this.serialNumber);
        } else {
            this.updateValues();
        }
    }

    updateValues() {
        // current temperature
        var currentTemperature = this.toHBTemperature(this.api.temperature);
        this.log.debug("Current temperature is " + currentTemperature + "°C", this.serialNumber);
        this.accessory
            .getService(ThermostatService)
            .getCharacteristic(Characteristic.CurrentTemperature)
            .updateValue(currentTemperature);

        // setpoint temperature
        var setPointTemperature = this.toHBTemperature(this.api.TargetTemperature);
        if (setPointTemperature < 10) setPointTemperature = 10;
        if (setPointTemperature > 38) setPointTemperature = 38;
        this.log.debug("Setpoint temperature is" + setPointTemperature + "°C", this.serialNumber);
        this.accessory
            .getService(ThermostatService)
            .getCharacteristic(Characteristic.TargetTemperature)
            .updateValue(setPointTemperature);

        // currently isHeating
        var CurrentHeatingCoolingState = 0;
        if (this.api.heating) {
            CurrentHeatingCoolingState = 1;
        }
        this.log.debug("Current heating state is " + CurrentHeatingCoolingState, this.serialNumber);
        this.accessory
            .getService(ThermostatService)
            .getCharacteristic(Characteristic.CurrentHeatingCoolingState)
            .updateValue(CurrentHeatingCoolingState);

        // system switch mode
        var TargetHeatingCooling = this.toHomeBridgeisHeatingCoolingSystem(0);
        this.log.debug("Target heating state is " + TargetHeatingCooling, this.serialNumber);
        this.accessory
            .getService(ThermostatService)
            .getCharacteristic(Characteristic.TargetHeatingCoolingState)
            .updateValue(TargetHeatingCooling);
    }

    // Utility Functions
    toNuHeatTemperature(temperature) {
        // homekit only deals with Celsius. NuHeat needs the temp as something weird. Convert to Farenheit and then Celsius
        return (((temperature * 9) / 5 + 32 - 33) * 56 + 33).toFixed(0);
    }

    toHBTemperature(temperature) {
        // homekit only deals with Celsius. NuHeat reports the temp as something weird. Convert to Farenheit and then Celsius
        return ((((temperature - 33) / 56 + 33 - 32) * 5) / 9).toFixed(1);
    }

    toHomeBridgeisHeatingCoolingSystem(isHeatingCoolingSystem) {
        switch (isHeatingCoolingSystem) {
            case 0:
            // emergency heat
            case 1:
                // heat
                return Characteristic.TargetHeatingCoolingState.HEAT;
                break;
            case 2:
                // off
                return Characteristic.TargetHeatingCoolingState.OFF;
                break;
            case 3:
            // cool
            case 7:
                // "Drying" (MHK1)
                return Characteristic.TargetHeatingCoolingState.COOL;
                break;
            case 4:
            // autoheat
            case 5:
                // autocool
                return Characteristic.TargetHeatingCoolingState.AUTO;
                break;
            case 6:
            // "Southern Away" humidity control
            default:
                return Characteristic.TargetHeatingCoolingState.OFF;
        }
    }

    toNuHeatisHeatingCoolingSystem(isHeatingCoolingSystem) {
        switch (isHeatingCoolingSystem) {
            case Characteristic.TargetHeatingCoolingState.OFF:
                // off
                return 2;
                break;
            case Characteristic.TargetHeatingCoolingState.HEAT:
                // heat
                return 1;
                break;
            case Characteristic.TargetHeatingCoolingState.COOL:
                // cool
                return 3;
                break;
            case Characteristic.TargetHeatingCoolingState.AUTO:
                // auto
                return 4;
                break;
            default:
                return 0;
        }
    }
};
