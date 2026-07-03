package com.openframe.test.listener;

import lombok.extern.slf4j.Slf4j;
import org.junit.platform.engine.TestExecutionResult;
import org.junit.platform.launcher.TestExecutionListener;
import org.junit.platform.launcher.TestIdentifier;
import org.junit.platform.launcher.TestPlan;

import java.util.ArrayList;
import java.util.List;

@Slf4j
public class SlackListener implements TestExecutionListener {

    private final SlackClient slackClient;

    private int testsFound = 0;
    private int testsSucceeded = 0;
    private int testsFailed = 0;
    private final List<String> testResults = new ArrayList<>();
    private boolean reported = true;

    public SlackListener(SlackClient slackClient) {
        this.slackClient = slackClient;
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
                            .map(SlackListener::truncateMessage)
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
            String skipReason = skipReason(reason);
            testResults.add(":fast_forward: " + testIdentifier.getDisplayName() + ": " + skipReason);
            log.info("Test skipped: {} - {}", testIdentifier.getDisplayName(), skipReason);
        }
    }

    /**
     * JUnit's default reason for a {@code @Disabled} test with no explicit value is the
     * fully-qualified method signature (e.g. {@code "void com...testGetAllTags() is @Disabled"}).
     * Collapse that to a clean label; keep any custom {@code @Disabled("...")} reason as-is.
     */
    private static String skipReason(String reason) {
        if (reason == null || reason.isBlank() || reason.endsWith("is @Disabled")) {
            return "Disabled";
        }
        return reason;
    }

    private static String truncateMessage(String message) {
        String firstLine = message.split("\n", 2)[0];
        return firstLine.length() > 300 ? firstLine.substring(0, 300) + "..." : firstLine;
    }

    public void sendResults(String tag, String domain, String baseUrl) {
        String env = domain.equals("localhost") ? "https://localhost" : String.format("`https://%s.%s`", domain, baseUrl);
        StringBuilder summary = new StringBuilder();
        summary.append("*Test Report*").append(testsFailed == 0 && testsSucceeded > 0 ? " :large_green_circle:" : " :red_circle:").append("\n\n");
        summary.append(String.format("Environment: %s\n", env));
        summary.append(String.format("Tag: %s", tag));

        StringBuilder details = new StringBuilder();
        if (!testResults.isEmpty()) {
            details.append("*Test Details:*\n");
            for (String result : testResults) {
                details.append(result).append("\n");
            }
        } else {
            summary.append("\n :x: No test results\n");
        }

        slackClient.postThreadedReport(summary.toString(), details.toString());
        reported = true;
    }
}
