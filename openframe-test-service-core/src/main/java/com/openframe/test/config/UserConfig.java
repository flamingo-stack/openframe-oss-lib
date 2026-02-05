package com.openframe.test.config;

import com.openframe.test.data.dto.user.User;
import lombok.extern.slf4j.Slf4j;

@Slf4j
public class UserConfig {

    public static final String DEFAULT_EMAIL = "auto@flamingo.cx";
    public static final String DEFAULT_PASSWORD = "Password123!";
    public static final String NEW_PASSWORD = "Password124!";
    private static final String DEFAULT_DOMAIN = "localhost";

    private static String email;
    private static String password;
    private static String domain;
    private static User user;

    public static User getUser() {
        if (user == null) {
            user = User.builder()
                    .email(getEmail())
                    .password(getPassword())
                    .domain(getDomain())
                    .build();
        }
        return user;
    }

    public static String getEmail() {
        if (email == null) {
            String cmdVar = System.getProperty("user.email");
            String envVar = System.getenv("USER_EMAIL");
            if (cmdVar != null && !cmdVar.trim().isEmpty()) {
                email = cmdVar;
            } else if (envVar != null && !envVar.trim().isEmpty()) {
                email = envVar;
            } else {
                email = DEFAULT_EMAIL;
            }
            log.debug("USER_EMAIL: {}", email);
        }
        return email;
    }

    public static String getPassword() {
        if (password == null) {
            String cmdVar = System.getProperty("user.password");
            String envVar = System.getenv("USER_PASSWORD");
            if (cmdVar != null && !cmdVar.trim().isEmpty()) {
                password = cmdVar;
            } else if (envVar != null && !envVar.trim().isEmpty()) {
                password = envVar;
            } else {
                password = DEFAULT_PASSWORD;
            }
        }
        return password;
    }

    public static String getDomain() {
        if (domain == null) {
            String cmdVar = System.getProperty("user.domain");
            String envVar = System.getenv("USER_DOMAIN");
            if (cmdVar != null && !cmdVar.trim().isEmpty()) {
                domain = cmdVar;
            } else if (envVar != null && !envVar.trim().isEmpty()) {
                domain = envVar;
            } else {
                domain = DEFAULT_DOMAIN;
            }
            log.debug("USER_DOMAIN: {}", domain);
        }
        return domain;
    }

}
