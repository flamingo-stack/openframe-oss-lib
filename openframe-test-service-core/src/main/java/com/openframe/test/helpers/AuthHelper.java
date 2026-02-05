package com.openframe.test.helpers;

import com.openframe.test.api.AuthFlow;
import com.openframe.test.config.UserConfig;

import java.util.Map;

public class AuthHelper {

    private static Map<String, String> cookies;

    public static Map<String, String> getCookies() {
        if (cookies == null) {
            cookies = AuthFlow.login(UserConfig.getUser());
        }
        return cookies;
    }

    public static void setCookies(Map<String, String> newCookies) {
        cookies = newCookies;
    }

}
