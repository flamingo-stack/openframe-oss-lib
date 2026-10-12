package com.openframe.client.controller;

import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.io.InputStream;
import java.util.Set;

@RestController
@RequestMapping("/tool-agent/{assetId}")
public class ToolAgentFileController {

    private static final Set<String> ALLOWED_ASSET_IDS = Set.of(
            "meshcentral-core-module"
    );

    // TODO: remove after github artifact is implemented
    //  Currently we return hardcoded content for testing purposes only
    @GetMapping
    public byte[] getToolAgentFile(@PathVariable String assetId, @RequestParam String os) {
        if (assetId.contains("application")) {
            throw new IllegalArgumentException("No asset available");
        }

        if (assetId.contains("/") || assetId.contains("\\") || assetId.contains("..")
                || !ALLOWED_ASSET_IDS.contains(assetId)) {
            throw new IllegalArgumentException("Unknown asset: " + assetId);
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
                throw new RuntimeException("No content");
            }
            return stream.readAllBytes();
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

}
