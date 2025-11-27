package com.openframe.management.service;

import com.openframe.data.service.OpenFrameClientUpdatePublisher;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class OpenFrameClientVersionUpdateService {

    private final OpenFrameClientUpdatePublisher openFrameClientUpdatePublisher;

    public void process(String newReleaseVersion) {

    }
}
