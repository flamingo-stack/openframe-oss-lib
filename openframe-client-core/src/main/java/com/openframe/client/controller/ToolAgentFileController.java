package com.openframe.client.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;

@Slf4j
@RestController
@RequestMapping("/tool-agent/{assetId}")
public class ToolAgentFileController {

    // TODO: remove after github artifact is implemented
    //  Currently we return hardcoded content for testing purposes only
    @GetMapping
    public byte[] getToolAgentFile(@PathVariable String assetId, @RequestParam String os) {
        if (assetId.contains("application")) {
            throw new IllegalArgumentException("No asset available");
        }

        String path = "/";
        if (os.equals("mac") || assetId.equals("meshcentral-core-module")) {
            path += assetId;
        } else if (os.equals("windows")) {
            path += assetId + ".exe";
        } else {
            throw new IllegalArgumentException("Unknown os: " + os);
        }

        try (InputStream stream = ToolAgentFileController.class.getResourceAsStream(path)) {
            if (stream == null) {
                log.error("No content found for tool agent file at path: {}", path);
                throw new IllegalStateException("No content");
            }
            return stream.readAllBytes();
        } catch (IOException e) {
            log.error("Failed to read tool agent file at path: {}", path, e);
            throw new UncheckedIOException(e);
        }
    }

}
