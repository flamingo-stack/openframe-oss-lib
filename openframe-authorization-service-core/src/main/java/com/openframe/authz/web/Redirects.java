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

    /**
     * Issue 302 redirect building URL against server root (ignoring contextPath).
     * Useful when you need to target a top-level path like "/oauth/...".
     */
    public static void foundAtRoot(HttpServletResponse response, String relativePath) {
        String absolute = ServletUriComponentsBuilder.fromCurrentRequestUri()
                .replacePath(relativePath)
                .replaceQuery(null)
                .build()
                .toUriString();
        response.setStatus(SC_FOUND);
        response.setHeader(LOCATION, absolute);
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