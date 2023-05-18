const axios = require("axios");
const config = require("./config");
const NuHeatThermostat = require("./thermostat").NuHeatThermostat;

class NuHeatAPI {
    constructor(log, username, password, sessionId = null, brand = config.NUHEAT) {
        this.username = username;
        this.password = password;
        this.log = log;
        this.sessionId = sessionId;
        this.brand = config.BRANDS.includes(brand) ? brand : config.BRANDS[0];
    }

    get hostname() {
        return config.HOSTNAMES[this.brand];
    }

    get apiUrl() {
        return `https://${this.hostname}/api`;
    }

    get authUrl() {
        return `${this.apiUrl}/authenticate/user`;
    }

    get requestHeaders() {
        return {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
            HOST: this.hostname,
            DNT: "1",
            Origin: this.apiUrl,
        };
    }

    async authenticate() {
        if (this.sessionId) {
            this.log.debug("Using existing NuHeat session");
            return;
        }

        this.log.debug("Creating NuHeat session");
        const postData = {
            Email: this.username,
            Password: this.password,
            application: "0",
        };
        const result = await this.request(this.authUrl, "POST", postData);

        const sessionId = result.SessionId;
        if (!sessionId) {
            throw new Error("Authentication error");
        }

        this.sessionId = sessionId;
    }

    getThermostat(serialNumber) {
        return new NuHeatThermostat(this, serialNumber, this.log);
    }

    async request(url, method = "GET", data = null, params = null, retry = true) {
        if (params && this.sessionId) {
            params.sessionid = this.sessionId;
        }

        let response;
        try {
            if (method === "GET") {
                response = await axios.get(url, { headers: this.requestHeaders, params: params });
            } else if (method === "POST") {
                response = await axios.post(url, data, { headers: this.requestHeaders, params: params });
            }

            // Handle expired sessions
            if (response.status === 401 && retry) {
                this.log.error("NuHeat API request unauthorized [401]. Try to re-authenticate.");
                this.sessionId = null;
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
