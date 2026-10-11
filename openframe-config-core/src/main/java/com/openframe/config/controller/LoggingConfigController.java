package com.openframe.config.controller;

import java.nio.charset.StandardCharsets;

import org.apache.commons.lang3.StringUtils;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StreamUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;

@RestController
@RequestMapping("/logging")
@Slf4j
public class LoggingConfigController {

    private static final int HTTP_DEFAULT_PORT = 80;
    private static final int HTTPS_DEFAULT_PORT = 443;

    @GetMapping(value = "/{filename:.+}", produces = MediaType.APPLICATION_XML_VALUE)
    public ResponseEntity<String> getLoggingConfig(@PathVariable String filename, HttpServletRequest request) throws Exception {
        log.debug("Received request for logging config file");

        if (filename.contains("..") || filename.startsWith("/") || filename.startsWith("\\")) {
            log.error("Rejected invalid logging config filename request");
            return ResponseEntity.notFound().build();
        }

        ClassPathResource resource = new ClassPathResource("logging/" + filename);

        if (!resource.exists()) {
            log.error("Resource not found for requested logging config file");
            return ResponseEntity.notFound().build();
        }

        String content = StreamUtils.copyToString(resource.getInputStream(), StandardCharsets.UTF_8);
        log.debug("Original content length: {}", content.length());

        String serverUrl = request.getScheme() + "://" + request.getServerName();
        if (request.getServerPort() != HTTP_DEFAULT_PORT && request.getServerPort() != HTTPS_DEFAULT_PORT) {
            serverUrl += ":" + request.getServerPort();
        }

        content = StringUtils.replace(content, "resource=\"logging/", "url=\"" + serverUrl + "/logging/");

        log.debug("Modified content length: {}", content.length());
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_XML)
                .body(content);
    }
}


