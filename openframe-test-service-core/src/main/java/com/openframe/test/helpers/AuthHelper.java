package com.openframe.test.helpers;

import com.openframe.test.api.AuthApi;
import com.openframe.test.api.auth.AuthFlow;
import com.openframe.test.config.UserConfig;

import java.util.Map;

public class AuthHelper {

    private static final ThreadLocal<Map<String, String>> cookies = new ThreadLocal<>();

    public static Map<String, String> getCookies() {
        if (cookies.get() == null) {
            cookies.set(AuthFlow.login(UserConfig.getUser()));
        }
        return cookies.get();
    }

    public static void setCookies(Map<String, String> newCookies) {
        cookies.set(newCookies);
    }

    public static Map<String, String> refresh() {
        Map<String, String> refreshed = AuthApi.refresh(getCookies());
        cookies.set(refreshed);
        return refreshed;
    }

    public static void clearCookies() {
        cookies.remove();
    }

}
