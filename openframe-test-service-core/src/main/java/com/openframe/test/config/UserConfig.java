package com.openframe.test.config;

import com.openframe.test.data.dto.user.User;
import lombok.extern.slf4j.Slf4j;
import net.datafaker.Faker;

@Slf4j
public class UserConfig {

    private static String email;
    private static String password;

    public static void configure(String email, String password) {
        UserConfig.email = email;
        UserConfig.password = password;
    }

    public static void random() {
        email = new Faker().letterify("??????@flamingo.cx");
    }

    public static User getUser() {
        return User.builder()
                .email(getEmail())
                .password(getPassword())
                .domain(getDomain())
                .build();
    }

    public static String getEmail() {
        if (email == null) {
            String envVar = System.getenv("TEST_USER_EMAIL");
            if (envVar != null && !envVar.trim().isEmpty()) {
                email = envVar;
            } else {
                throw new RuntimeException("TEST_USER_EMAIL environment variable is not set");
            }
            log.debug("TEST_USER_EMAIL: {}", email);
        }
        return email;
    }

    public static String getPassword() {
        if (password == null) {
            String envVar = System.getenv("TEST_USER_PASSWORD");
            if (envVar != null && !envVar.trim().isEmpty()) {
                password = envVar;
            } else {
                throw new RuntimeException("TEST_USER_PASSWORD environment variable is not set");
            }
            log.debug("TEST_USER_PASSWORD: {}", password);
        }
        return password;
    }

    public static String getDomain() {
        return EnvironmentConfig.getUserDomain();
    }

    /**
     * Whether an admin login is possible, without throwing. Mirrors the lazy reads above; suites gate on
     * this via {@code @EnabledIf} so an environment with no credentials reports as skipped rather than
     * erroring on the first request.
     */
    public static boolean hasCredentials() {
        return isAvailable(email, "TEST_USER_EMAIL") && isAvailable(password, "TEST_USER_PASSWORD");
    }

    private static boolean isAvailable(String configured, String envVarName) {
        if (configured != null) {
            return true;
        }
        String envVar = System.getenv(envVarName);
        return envVar != null && !envVar.trim().isEmpty();
    }

}
