package com.openframe.config.controller;

import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.regex.Pattern;

@Slf4j
@RestController
@RequestMapping(LoggingConfigController.LOGGING_PATH)
public class LoggingConfigController {

    static final String LOGGING_PATH = "/logging";

    private static final String RESOURCE_DIR = "logging/";
    private static final String CLASSPATH_INCLUDE = "resource=\"" + RESOURCE_DIR;
    // Allow-list: the path variable must not reach other classpath resources such as application.yml.
    private static final Pattern LOGBACK_FILE = Pattern.compile("[a-z0-9-]+\\.xml");

    @GetMapping(value = "/{filename:.+}", produces = MediaType.APPLICATION_XML_VALUE)
    public ResponseEntity<String> getLoggingConfig(@PathVariable String filename, HttpServletRequest request) {
        ClassPathResource resource = new ClassPathResource(RESOURCE_DIR + filename);
        if (!isLogbackFile(filename) || !resource.exists()) {
            log.warn("Logging config not found: {}", filename);
            return ResponseEntity.notFound().build();
        }
        String content = read(resource);
        // A service loads this file over HTTP, so its includes must resolve on this server, not on the service's classpath.
        String loggingUrl = ServletUriComponentsBuilder.fromContextPath(request)
                .path(LOGGING_PATH + "/")
                .toUriString();
        String body = content.replace(CLASSPATH_INCLUDE, "url=\"" + loggingUrl);
        return ResponseEntity.ok(body);
    }

    private boolean isLogbackFile(String filename) {
        return LOGBACK_FILE.matcher(filename).matches();
    }

    private String read(ClassPathResource resource) {
        try {
            return resource.getContentAsString(StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot read logging config " + resource.getPath(), e);
        }
    }
}
