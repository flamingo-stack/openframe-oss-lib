package com.openframe.test.config;

import lombok.extern.slf4j.Slf4j;

// SSH verification target for device E2E cases; values may be injected via configure() or read lazily from env vars.
@Slf4j
public class MachineConfig {

    private static final String DEFAULT_PORT = "22";
    private static final MachineOs DEFAULT_OS = MachineOs.WINDOWS;

    private static String hostname;
    private static String sshHost;
    private static String sshPort;
    private static String sshUser;
    private static String sshPassword;
    private static MachineOs os;
    // Optional second ("control") machine for multi-host / blast-radius cases. Shares the primary's SSH
    // port, user, password and OS; only its hostname and SSH host differ. Null when not configured.
    private static String controlHostname;
    private static String controlSshHost;
    private static boolean loaded = false;

    public static void configure(String hostname, String sshHost, String sshPort,
                                 String sshUser, String sshPassword, MachineOs os) {
        MachineConfig.hostname = hostname;
        MachineConfig.sshHost = sshHost;
        MachineConfig.sshPort = (sshPort == null || sshPort.isBlank()) ? DEFAULT_PORT : sshPort;
        MachineConfig.sshUser = sshUser;
        MachineConfig.sshPassword = sshPassword;
        MachineConfig.os = os == null ? DEFAULT_OS : os;
        loaded = true;
    }

    private static void loadEnv() {
        if (loaded) {
            return;
        }
        hostname = required("TARGET_HOSTNAME");
        sshHost = required("TARGET_SSH_HOST");
        sshUser = required("TARGET_SSH_USER");
        sshPassword = required("TARGET_SSH_PASSWORD");
        String port = System.getenv("TARGET_SSH_PORT");
        sshPort = (port == null || port.isBlank()) ? DEFAULT_PORT : port.trim();
        String osVar = System.getenv("TARGET_OS");
        os = (osVar == null || osVar.isBlank()) ? DEFAULT_OS : MachineOs.valueOf(osVar.trim().toUpperCase());
        controlHostname = trimToNull(System.getenv("CONTROL_HOSTNAME"));
        controlSshHost = trimToNull(System.getenv("CONTROL_SSH_HOST"));
        log.debug("TARGET_HOSTNAME: {}", hostname);
        log.debug("TARGET_SSH_HOST: {} port {} user {} os {}", sshHost, sshPort, sshUser, os);
        log.debug("CONTROL_HOSTNAME: {} host {}", controlHostname, controlSshHost);
        loaded = true;
    }

    private static String trimToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }

    private static String required(String key) {
        String value = System.getenv(key);
        if (value == null || value.trim().isEmpty()) {
            throw new RuntimeException(key + " environment variable is not set");
        }
        return value.trim();
    }

    // Whether a target machine is configured at all, so a case outside the ai suite can skip without one.
    public static boolean isConfigured() {
        return loaded || (trimToNull(System.getenv("TARGET_HOSTNAME")) != null
                && trimToNull(System.getenv("TARGET_SSH_HOST")) != null
                && trimToNull(System.getenv("TARGET_SSH_USER")) != null
                && trimToNull(System.getenv("TARGET_SSH_PASSWORD")) != null);
    }

    public static String getHostname() {
        loadEnv();
        return hostname;
    }

    public static String getSshHost() {
        loadEnv();
        return sshHost;
    }

    public static int getSshPort() {
        loadEnv();
        return Integer.parseInt(sshPort);
    }

    public static String getSshUser() {
        loadEnv();
        return sshUser;
    }

    public static String getSshPassword() {
        loadEnv();
        return sshPassword;
    }

    public static MachineOs getOs() {
        loadEnv();
        return os;
    }

    // Null when no control machine is configured.
    public static String getControlHostname() {
        loadEnv();
        return controlHostname;
    }

    // Null when no control machine is configured.
    public static String getControlSshHost() {
        loadEnv();
        return controlSshHost;
    }

    // True only if both control fields are present, since they're configured together.
    public static boolean hasControlMachine() {
        loadEnv();
        return controlHostname != null && controlSshHost != null;
    }
}
