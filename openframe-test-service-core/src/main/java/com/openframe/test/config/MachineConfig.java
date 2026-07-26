package com.openframe.test.config;

import lombok.extern.slf4j.Slf4j;

/**
 * Coordinates of the SSH verification target used by device E2E cases (channel B). Follows the same
 * lazy env-var pattern as {@link MongoConfig}: values may be injected programmatically via
 * {@link #configure} (e.g. by the runner service), otherwise they are read from the environment on
 * first access and the getter fails fast if a required key is missing.
 *
 * <p>{@code hostname} is the enrolled device's name in the tenant — the assistant is targeted by it in
 * the prompt, and the online precheck confirms it is in the ONLINE device set (no machine id needed).
 * The SSH fields are how the test independently reaches the same box.
 */
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

    /** Hostname of the optional control machine, or {@code null} if no second machine is configured. */
    public static String getControlHostname() {
        loadEnv();
        return controlHostname;
    }

    /** SSH host of the optional control machine, or {@code null} if no second machine is configured. */
    public static String getControlSshHost() {
        loadEnv();
        return controlSshHost;
    }

    /** Whether a second (control) machine is configured for multi-host cases. */
    public static boolean hasControlMachine() {
        loadEnv();
        return controlHostname != null && controlSshHost != null;
    }
}
