package com.openframe.test.listener;

import com.slack.api.Slack;
import com.slack.api.methods.SlackApiException;
import com.slack.api.methods.response.chat.ChatPostMessageResponse;
import lombok.extern.slf4j.Slf4j;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

@Slf4j
public class SlackClient {

    private static final int MAX_CHUNK_SIZE = 3000;

    private final String botToken;
    private final String channelId;

    public SlackClient(String botToken, String channelId) {
        this.botToken = botToken;
        this.channelId = channelId;
    }

    public void postMessage(String text) {
        if (!isConfigured()) {
            logMessage(text);
            return;
        }

        try {
            ChatPostMessageResponse response = Slack.getInstance().methods(botToken)
                    .chatPostMessage(req -> req.channel(channelId).text(text));
            if (response.isOk()) {
                log.info("Slack message sent successfully");
            } else {
                log.error("Slack API error: {}", response.getError());
            }
        } catch (IOException | SlackApiException e) {
            log.error("Failed to send Slack message", e);
        }
    }

    public void postThreadedReport(String summary, String details) {
        List<String> chunks = splitIntoChunks(details, MAX_CHUNK_SIZE);

        if (!isConfigured()) {
            logMessage(summary);
            for (String chunk : chunks) {
                logMessage(chunk);
            }
            return;
        }

        try {
            ChatPostMessageResponse mainResponse = Slack.getInstance().methods(botToken)
                    .chatPostMessage(req -> req.channel(channelId).text(summary));
            if (!mainResponse.isOk()) {
                log.error("Slack API error posting summary: {}", mainResponse.getError());
                return;
            }
            String threadTs = mainResponse.getTs();
            log.info("Slack summary posted, ts={}", threadTs);

            for (String chunk : chunks) {
                ChatPostMessageResponse threadResponse = Slack.getInstance().methods(botToken)
                        .chatPostMessage(req -> req.channel(channelId).threadTs(threadTs).text(chunk));
                if (!threadResponse.isOk()) {
                    log.error("Slack API error posting thread reply: {}", threadResponse.getError());
                }
            }
        } catch (IOException | SlackApiException e) {
            log.error("Failed to send threaded Slack report", e);
        }
    }

    private static List<String> splitIntoChunks(String text, int maxLength) {
        List<String> chunks = new ArrayList<>();
        String[] lines = text.split("\n");
        StringBuilder current = new StringBuilder();
        for (String line : lines) {
            if (current.length() + line.length() + 1 > maxLength && !current.isEmpty()) {
                chunks.add(current.toString());
                current = new StringBuilder();
            }
            if (!current.isEmpty()) {
                current.append("\n");
            }
            current.append(line);
        }
        if (!current.isEmpty()) {
            chunks.add(current.toString());
        }
        return chunks;
    }

    private boolean isConfigured() {
        return botToken != null && !botToken.isBlank() && channelId != null && !channelId.isBlank();
    }

    private void logMessage(String text) {
        log.warn("Slack not configured — skipping notification");
        for (String line : text.split("\n"))
            log.info(line);
    }
}
