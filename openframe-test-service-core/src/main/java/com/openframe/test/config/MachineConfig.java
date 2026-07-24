package com.openframe.test.config;

import lombok.extern.slf4j.Slf4j;

/**
 * Coordinates of the SSH verification target used by device E2E cases (channel B). Follows the same
 * lazy env-var pattern as {@link MongoConfig}: values may be injected programmatically via
 * {@link #configure} (e.g. by the runner service), otherwise they are read from the environment on
 * first access and the getter fails fast if a required key is missing.
 *
 * <p>{@code machineId} is the enrolled device id in the tenant (used for the online precheck and to
 * bind the targeting ticket); the SSH fields are how the test independently reaches the same box.
 */
@Slf4j
public class MachineConfig {

    private static final String DEFAULT_PORT = "22";
    private static final MachineOs DEFAULT_OS = MachineOs.WINDOWS;

    private static String machineId;
    private static String sshHost;
    private static String sshPort;
    private static String sshUser;
    private static String sshPassword;
    private static MachineOs os;
    private static boolean loaded = false;

    public static void configure(String machineId, String sshHost, String sshPort,
                                 String sshUser, String sshPassword, MachineOs os) {
        MachineConfig.machineId = machineId;
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
        machineId = required("TARGET_MACHINE_ID");
        sshHost = required("TARGET_SSH_HOST");
        sshUser = required("TARGET_SSH_USER");
        sshPassword = required("TARGET_SSH_PASSWORD");
        String port = System.getenv("TARGET_SSH_PORT");
        sshPort = (port == null || port.isBlank()) ? DEFAULT_PORT : port.trim();
        String osVar = System.getenv("TARGET_OS");
        os = (osVar == null || osVar.isBlank()) ? DEFAULT_OS : MachineOs.valueOf(osVar.trim().toUpperCase());
        log.debug("TARGET_MACHINE_ID: {}", machineId);
        log.debug("TARGET_SSH_HOST: {} port {} user {} os {}", sshHost, sshPort, sshUser, os);
        loaded = true;
    }

    private static String required(String key) {
        String value = System.getenv(key);
        if (value == null || value.trim().isEmpty()) {
            throw new RuntimeException(key + " environment variable is not set");
        }
        return value.trim();
    }

    public static String getMachineId() {
        loadEnv();
        return machineId;
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
}
