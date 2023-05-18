const axios = require("axios");
const config = require("./config");
const NuHeatThermostat = require("./thermostat").NuHeatThermostat;

class NuHeatAPI {
    constructor(log, username, password, sessionId = null, brand = config.NUHEAT) {
        this.username = username;
        this.password = password;
        this.log = log;
        this._sessionId = sessionId;
        this._brand = config.BRANDS.includes(brand) ? brand : config.BRANDS[0];
    }

    toString() {
        return `<NuHeat username='${this.username}'>`;
    }

    get _hostname() {
        return config.HOSTNAMES[this._brand];
    }

    get _apiUrl() {
        return `https://${this._hostname}/api`;
    }

    get _authUrl() {
        return `${this._apiUrl}/authenticate/user`;
    }

    get _requestHeaders() {
        return {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
            HOST: this._hostname,
            DNT: "1",
            Origin: this._apiUrl,
        };
    }

    async authenticate() {
        if (this._sessionId) {
            this.log.debug("Using existing NuHeat session");
            return;
        }

        this.log.debug("Creating NuHeat session");
        const postData = {
            Email: this.username,
            Password: this.password,
            application: "0",
        };
        const result = await this.request(this._authUrl, "POST", postData);

        const sessionId = result.SessionId;
        if (!sessionId) {
            throw new Error("Authentication error");
        }

        this._sessionId = sessionId;
    }

    getThermostat(serialNumber) {
        return new NuHeatThermostat(this, serialNumber, this.log);
    }

    async request(url, method = "GET", data = null, params = null, retry = true) {
        if (params && this._sessionId) {
            params.sessionid = this._sessionId;
        }

        let response;
        try {
            if (method === "GET") {
                response = await axios.get(url, { headers: this._requestHeaders, params: params });
            } else if (method === "POST") {
                response = await axios.post(url, data, { headers: this._requestHeaders, params: params });
            }

            // Handle expired sessions
            if (response.status === 401 && retry) {
                this.log.error("NuHeat API request unauthorized [401]. Try to re-authenticate.");
                this._sessionId = null;
                await this.authenticate();
                return this.request(url, method, data, params, false);
            }

            return response.data;
        } catch (error) {
            this.log.error(error);
            throw error;
        }
    }
}
module.exports = NuHeatAPI;
