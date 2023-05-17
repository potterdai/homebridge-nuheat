const NUHEAT = "NUHEAT";
const MAPEHEAT = "MAPEHEAT";
const BRANDS = [NUHEAT, MAPEHEAT];
const HOSTNAMES = {
    [NUHEAT]: "mynuheat.com",
    [MAPEHEAT]: "mymapeheat.com",
};

// NuHeat Schedule Modes
const SCHEDULE_RUN = 1;
const SCHEDULE_TEMPORARY_HOLD = 2;  // hold the target temperature until the next scheduled program
const SCHEDULE_HOLD = 3;  // hold the target temperature until it is manually changed

const config = {
    NUHEAT,
    MAPEHEAT,
    BRANDS,
    HOSTNAMES,
    SCHEDULE_RUN,
    SCHEDULE_TEMPORARY_HOLD,
    SCHEDULE_HOLD,
};

module.exports = config;