package com.openframe.management.service;

import com.openframe.data.nats.publisher.OpenFrameClientUpdatePublisher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class OpenFrameClientVersionUpdateService {

    private final OpenFrameClientUpdatePublisher openFrameClientUpdatePublisher;

    public void process(String newReleaseVersion) {
        log.warn("OpenFrameClientVersionUpdateService.process() is not implemented yet; " +
                "release version {} was not published", newReleaseVersion);
        throw new UnsupportedOperationException("OpenFrameClientVersionUpdateService.process() is not implemented yet");
    }
}
