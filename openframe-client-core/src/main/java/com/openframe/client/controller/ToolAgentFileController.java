package com.openframe.client.controller;

import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.io.IOException;
import java.io.InputStream;

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
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No content");
            }
            return stream.readAllBytes();
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to read tool agent file", e);
        }
    }

}
