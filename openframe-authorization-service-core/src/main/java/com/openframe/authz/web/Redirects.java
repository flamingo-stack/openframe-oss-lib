package com.openframe.authz.web;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import static jakarta.servlet.http.HttpServletResponse.SC_FOUND;
import static jakarta.servlet.http.HttpServletResponse.SC_SEE_OTHER;
import static org.springframework.http.HttpHeaders.LOCATION;

public final class Redirects {
    private Redirects() {
    }

    public static void seeOther(HttpServletResponse response, String relativePath) {
        redirect(response, SC_SEE_OTHER, relativePath);
    }

    public static void found(HttpServletResponse response, String relativePath) {
        redirect(response, SC_FOUND, relativePath);
    }

    private static String buildAbsolute(String relativePath) {
        return ServletUriComponentsBuilder.fromCurrentContextPath()
                .path(relativePath)
                .build()
                .toUriString();
    }

    private static void redirect(HttpServletResponse response, int status, String relativePath) {
        String absolute = buildAbsolute(relativePath);
        response.setStatus(status);
        response.setHeader(LOCATION, absolute);
    }
}

