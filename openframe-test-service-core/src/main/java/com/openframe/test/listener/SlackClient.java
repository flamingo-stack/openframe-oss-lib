package com.openframe.test.listener;

import com.slack.api.Slack;
import com.slack.api.methods.SlackApiException;
import com.slack.api.methods.response.chat.ChatPostMessageResponse;
import com.slack.api.webhook.Payload;
import com.slack.api.webhook.WebhookResponse;
import lombok.extern.slf4j.Slf4j;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

@Slf4j
public class SlackClient {

    private static final int MAX_CHUNK_SIZE = 3000;

    private final String botToken;
    private final String channelId;
    private final String webHookUrl;

    public SlackClient(String botToken, String channelId, String webHookUrl) {
        this.botToken = botToken;
        this.channelId = channelId;
        this.webHookUrl = webHookUrl;
    }

    public SlackClient(String botToken, String channelId) {
        this(botToken, channelId, null);
    }

    public SlackClient(String webHookUrl) {
        this(null, null, webHookUrl);
    }

    public void postMessage(String text) {
        if (isBotConfigured()) {
            postMessageViaBot(text);
        } else if (isWebhookConfigured()) {
            postMessageViaWebhook(text);
        } else {
            logMessage(text);
        }
    }

    public void postThreadedReport(String summary, String details) {
        List<String> chunks = splitIntoChunks(details, MAX_CHUNK_SIZE);

        if (isBotConfigured()) {
            postThreadedReportViaBot(summary, chunks);
        } else if (isWebhookConfigured()) {
            postThreadedReportViaWebhook(summary, chunks);
        } else {
            logMessage(summary);
            for (String chunk : chunks) {
                logMessage(chunk);
            }
        }
    }

    private void postMessageViaBot(String text) {
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

    private void postMessageViaWebhook(String text) {
        try {
            WebhookResponse response = Slack.getInstance().send(webHookUrl,
                    Payload.builder().text(text).build());
            if (response.getCode() == 200) {
                log.info("Slack webhook message sent successfully");
            } else {
                log.error("Slack webhook error: {} {}", response.getCode(), response.getMessage());
            }
        } catch (IOException e) {
            log.error("Failed to send Slack webhook message", e);
        }
    }

    private void postThreadedReportViaBot(String summary, List<String> chunks) {
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

    private void postThreadedReportViaWebhook(String summary, List<String> chunks) {
        String combined = summary + "\n\n" + String.join("\n", chunks);
        List<String> combinedChunks = splitIntoChunks(combined, MAX_CHUNK_SIZE);
        for (String chunk : combinedChunks) {
            postMessageViaWebhook(chunk);
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

    private boolean isBotConfigured() {
        return botToken != null && !botToken.isBlank() && channelId != null && !channelId.isBlank();
    }

    private boolean isWebhookConfigured() {
        return webHookUrl != null && !webHookUrl.isBlank();
    }

    private void logMessage(String text) {
        log.warn("Slack not configured — skipping notification");
        for (String line : text.split("\n"))
            log.info(line);
    }
}
