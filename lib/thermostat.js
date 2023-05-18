const config = require("./config");

class NuHeatThermostat {
    constructor(nuheatSession, serialNumber, log) {
        this.session = nuheatSession;
        this.serialNumber = serialNumber;
        this.log = log;
        this.fetchData();
    }

    async fetchData() {
        const params = { serialnumber: this.serialNumber };
        const data = await this.session.request(this.url, "GET", undefined, params);

        this.data = data;
        this.heating = data.Heating;
        this.online = data.Online;
        this.room = data.Room;
        this.serialNumber = data.SerialNumber;
        this.temperature = data.Temperature;
        this.minTemperature = data.MinTemp;
        this.maxTemperature = data.MaxTemp;

        this._targetTemperature = data.SetPointTemp;
        this._scheduleMode = data.ScheduleMode;
        this._operatingMode = data.OperatingMode;
        this._holdTime = new Date(data.HoldSetPointDateTime);
    }

    get url() {
        return this.session.apiUrl + "/thermostat";
    }

    get scheduleMode() {
        return this._scheduleMode;
    }

    async setScheduleMode(value) {
        if (value === this._scheduleMode) {
            return;
        }

        const data = {
            ScheduleMode: value,
        };

        await this.setData(data);

        this._scheduleMode = value;
    }

    get holdTime() {
        return this._holdTime;
    }

    async setHoldTime(value) {
        if (value === this._holdTime) {
            return;
        }

        const data = {
            ScheduleMode: config.SCHEDULE_TEMPORARY_HOLD,
            HoldSetPointDateTime: value.toISOString(),
        };

        await this.setData(data);

        this._holdTime = value;
    }

    get targetTemperature() {
        return this._targetTemperature;
    }

    async setTargetTemperature(value) {
        if (value === this._targetTemperature) {
            return;
        }

        const data = {
            SetPointTemp: value,
            ScheduleMode: config.SCHEDULE_HOLD,
        };

        await this.setData(data);

        this._targetTemperature = value;
    }

    get operatingMode() {
        return this._operatingMode;
    }

    async setOperatingMode(value) {
        if (value === this._operatingMode) {
            return;
        }

        const data = {
            OperatingMode: value,
        };

        await this.setData(data);

        this._operatingMode = value;
    }

    async setData(postData) {
        // Update (patch) the current instance's data on the NuHeat API

        params = {
            serialnumber: self.serialNumber,
        };

        await this.session.request(this.url, "POST", postData, params);
    }
}

exports.NuHeatThermostat = NuHeatThermostat;
