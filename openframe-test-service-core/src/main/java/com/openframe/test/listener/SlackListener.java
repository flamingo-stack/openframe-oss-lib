package com.openframe.test.listener;

import lombok.extern.slf4j.Slf4j;
import org.junit.platform.engine.TestExecutionResult;
import org.junit.platform.launcher.TestExecutionListener;
import org.junit.platform.launcher.TestIdentifier;
import org.junit.platform.launcher.TestPlan;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Accumulates results across a run and posts one report.
 *
 * <p><b>Every field here is written concurrently.</b> Under parallel execution JUnit calls the
 * listener from each worker thread, so plain {@code int++} loses increments and an {@code ArrayList}
 * can drop entries or corrupt itself outright — a report that silently under-counts is worse than no
 * report. The counters are atomic and the list is copy-on-write: writes are one per test (a few
 * hundred at most) so the copy cost is irrelevant, and it lets {@link #sendResults} iterate without
 * holding a lock.
 *
 * <p>{@code reported} is volatile because it is written by the thread running the test plan and read
 * by the pipeline thread that calls {@link #sendResults} — true before parallel execution as well.
 */
@Slf4j
public class SlackListener implements TestExecutionListener {

    private final SlackClient slackClient;

    private final AtomicInteger testsFound = new AtomicInteger();
    private final AtomicInteger testsSucceeded = new AtomicInteger();
    private final AtomicInteger testsFailed = new AtomicInteger();
    private final List<String> testResults = new CopyOnWriteArrayList<>();
    private volatile boolean reported = true;

    public SlackListener(SlackClient slackClient) {
        this.slackClient = slackClient;
    }

    @Override
    public void testPlanExecutionStarted(TestPlan testPlan) {
        if (reported) {
            testsFound.set(0);
            testsSucceeded.set(0);
            testsFailed.set(0);
            testResults.clear();
            reported = false;
        }
    }

    @Override
    public void executionStarted(TestIdentifier testIdentifier) {
        if (testIdentifier.isTest()) {
            testsFound.incrementAndGet();
        }
    }

    @Override
    public void executionFinished(TestIdentifier testIdentifier, TestExecutionResult testExecutionResult) {
        if (testIdentifier.isTest()) {
            switch (testExecutionResult.getStatus()) {
                case SUCCESSFUL -> {
                    testsSucceeded.incrementAndGet();
                    testResults.add(":white_check_mark: " + testIdentifier.getDisplayName());
                }
                case FAILED -> {
                    testsFailed.incrementAndGet();
                    String message = testExecutionResult.getThrowable()
                            .map(Throwable::getMessage)
                            .map(SlackListener::truncateMessage)
                            .orElse("Unknown error");
                    testResults.add(":x: " + testIdentifier.getDisplayName() + ": " + message);
                }
                case ABORTED -> {
                    testsFailed.incrementAndGet();
                    testResults.add(":x: " + testIdentifier.getDisplayName() + ": Test aborted");
                }
            }
        }
    }

    @Override
    public void executionSkipped(TestIdentifier testIdentifier, String reason) {
        if (testIdentifier.isTest()) {
            testsFound.incrementAndGet();
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
        summary.append("*Test Report*").append(testsFailed.get() == 0 && testsSucceeded.get() > 0 ? " :large_green_circle:" : " :red_circle:").append("\n\n");
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
