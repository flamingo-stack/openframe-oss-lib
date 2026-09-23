package com.openframe.client.controller;

import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.io.InputStream;
import java.util.Set;

@RestController
@RequestMapping("/tool-agent/{assetId}")
public class ToolAgentFileController {

    // TODO: remove after github artifact is implemented
    //  Currently we return hardcoded content for testing purposes only
    private static final Set<String> ALLOWED_ASSET_IDS = Set.of(
            "meshcentral-core-module"
    );

    private static final Set<String> ALLOWED_OS = Set.of("mac", "windows");

    @GetMapping
    public byte[] getToolAgentFile(@PathVariable String assetId, @RequestParam String os) {
        if (!ALLOWED_OS.contains(os)) {
            throw new IllegalArgumentException("Unknown os: " + os);
        }
        if (!ALLOWED_ASSET_IDS.contains(assetId)) {
            throw new IllegalArgumentException("No asset available");
        }

        String path = "/";
        if (os.equals("mac") || assetId.equals("meshcentral-core-module")) {
            path += assetId;
        } else {
            path += assetId + ".exe";
        }

        try (InputStream stream = ToolAgentFileController.class.getResourceAsStream(path)) {
            if (stream == null) {
                throw new RuntimeException("No content");
            }
            return stream.readAllBytes();
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

}
