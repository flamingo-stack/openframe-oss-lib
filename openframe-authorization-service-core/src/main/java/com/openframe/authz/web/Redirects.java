package com.openframe.authz.web;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import static jakarta.servlet.http.HttpServletResponse.SC_SEE_OTHER;
import static org.springframework.http.HttpHeaders.LOCATION;

public final class Redirects {
    private Redirects() {
    }

    public static void seeOther(HttpServletResponse response, String relativePath) {
        String absolute = ServletUriComponentsBuilder.fromCurrentContextPath()
                .path(relativePath)
                .build()
                .toUriString();
        response.setStatus(SC_SEE_OTHER);
        response.setHeader(LOCATION, absolute);
    }
}

