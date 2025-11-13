package com.openframe.config.controller;

import java.nio.charset.StandardCharsets;

import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StreamUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/logging")
public class LoggingConfigController {
    private static final Logger log = LoggerFactory.getLogger(LoggingConfigController.class);

    @GetMapping(value = "/{filename:.+}", produces = MediaType.APPLICATION_XML_VALUE)
    public ResponseEntity<String> getLoggingConfig(@PathVariable String filename, HttpServletRequest request) throws Exception {
        log.debug("Received request for logging config file: {}", filename);

        ClassPathResource resource = new ClassPathResource("logging/" + filename);
        log.debug("Looking for resource at: logging/{}", filename);

        if (!resource.exists()) {
            log.error("Resource not found: logging/{}", filename);
            return ResponseEntity.notFound().build();
        }

        String content = StreamUtils.copyToString(resource.getInputStream(), StandardCharsets.UTF_8);
        log.debug("Original content length: {}", content.length());

        String serverUrl = request.getScheme() + "://" + request.getServerName();
        if (request.getServerPort() != 80 && request.getServerPort() != 443) {
            serverUrl += ":" + request.getServerPort();
        }
        log.debug("Server URL: {}", serverUrl);

        content = StringUtils.replace(content, "resource=\"logging/", "url=\"" + serverUrl + "/logging/");

        log.debug("Modified content length: {}", content.length());
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_XML)
                .body(content);
    }
}


