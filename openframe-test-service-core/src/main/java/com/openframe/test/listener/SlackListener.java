package com.openframe.test.listener;

import com.slack.api.Slack;
import com.slack.api.webhook.Payload;
import lombok.extern.slf4j.Slf4j;
import org.junit.platform.engine.TestExecutionResult;
import org.junit.platform.launcher.TestExecutionListener;
import org.junit.platform.launcher.TestIdentifier;
import org.junit.platform.launcher.TestPlan;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

@Slf4j
public class SlackListener implements TestExecutionListener {

    private final String webhookUrl;

    private int testsFound = 0;
    private int testsSucceeded = 0;
    private int testsFailed = 0;
    private final List<String> testResults = new ArrayList<>();
    private boolean reported = true;

    public SlackListener(String webhookUrl) {
        this.webhookUrl = webhookUrl;
    }

    @Override
    public void testPlanExecutionStarted(TestPlan testPlan) {
        if (reported) {
            testsFound = 0;
            testsSucceeded = 0;
            testsFailed = 0;
            testResults.clear();
            reported = false;
        }
    }

    @Override
    public void executionStarted(TestIdentifier testIdentifier) {
        if (testIdentifier.isTest()) {
            testsFound++;
        }
    }

    @Override
    public void executionFinished(TestIdentifier testIdentifier, TestExecutionResult testExecutionResult) {
        if (testIdentifier.isTest()) {
            switch (testExecutionResult.getStatus()) {
                case SUCCESSFUL -> {
                    testsSucceeded++;
                    testResults.add(":white_check_mark: " + testIdentifier.getDisplayName());
                }
                case FAILED -> {
                    testsFailed++;
                    String message = testExecutionResult.getThrowable()
                            .map(Throwable::getMessage)
                            .orElse("Unknown error");
                    testResults.add(":x: " + testIdentifier.getDisplayName() + ": " + message);
                }
                case ABORTED -> {
                    testsFailed++;
                    testResults.add(":x: " + testIdentifier.getDisplayName() + ": Test aborted");
                }
            }
        }
    }

    @Override
    public void executionSkipped(TestIdentifier testIdentifier, String reason) {
        if (testIdentifier.isTest()) {
            testsFound++;
            testResults.add(":fast_forward: " + testIdentifier.getDisplayName() + ": " + reason);
            log.info("Test skipped: {} - {}", testIdentifier.getDisplayName(), reason);
        }
    }

    public void sendResults(String tag, String domain, String baseUrl) {
        String env = domain.equals("localhost") ? "https://localhost" : String.format("`https://%s.%s`\n", domain, baseUrl);
        StringBuilder sb = new StringBuilder();
        sb.append("*Test Results*\n\n");
        sb.append(String.format("Environment: %s\n", env));
        sb.append(String.format("Tag: %s\n", tag));
        sb.append(String.format("Tests found: *%d*\n", testsFound));
        sb.append(String.format("Tests succeeded: *%d*\n", testsSucceeded));
        sb.append(String.format("Tests failed: *%d*\n", testsFailed));

        if (!testResults.isEmpty()) {
            sb.append("\n*Test Details:*\n");
            for (String result : testResults) {
                sb.append(result).append("\n");
            }
        }

        if (testsFailed == 0) {
            sb.append("\n:white_check_mark: All tests passed!");
        }

        postMessage(sb.toString());
        reported = true;
    }

    public void sendProvisioningTimeout(String clusterName) {
        String message = String.format(
                ":warning: *Cluster Provisioning Timeout*\n\n" +
                        "Cluster `%s` did not become READY within the configured timeout.\n" +
                        "Registration tests were *skipped* for this scheduled run.",
                clusterName != null ? clusterName : "unknown");
        postMessage(message);
    }

    private void postMessage(String text) {
        if (webhookUrl == null || webhookUrl.isBlank()) {
            log.warn("Slack webhook URL not configured — skipping Slack notification");
            for (String line : text.split("\n"))
                log.info(line);
            return;
        }

        try {
            Slack.getInstance().send(webhookUrl, Payload.builder().text(text).build());
            log.info("Slack message sent successfully");
        } catch (IOException e) {
            log.error("Failed to send Slack message", e);
        }
    }
}
