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

    private static final String ASSUMPTION_PREFIX = "Assumption failed: ";

    private final SlackClient slackClient;

    private final AtomicInteger testsSucceeded = new AtomicInteger();
    private final AtomicInteger testsFailed = new AtomicInteger();
    private final AtomicInteger testsSkipped = new AtomicInteger();
    private final List<String> testResults = new CopyOnWriteArrayList<>();
    private volatile boolean reported = true;

    /** Held so a skipped or aborted class can say how many cases went with it. */
    private volatile TestPlan testPlan;

    public SlackListener(SlackClient slackClient) {
        this.slackClient = slackClient;
    }

    @Override
    public void testPlanExecutionStarted(TestPlan testPlan) {
        this.testPlan = testPlan;
        if (reported) {
            testsSucceeded.set(0);
            testsFailed.set(0);
            testsSkipped.set(0);
            testResults.clear();
            reported = false;
        }
    }

    /**
     * An aborted test has not failed. {@code assumeTrue} is how a case says the state it needs is not in
     * the tenant, so it is reported as a skip carrying the assumption's own message — previously it landed
     * on the failure counter as {@code :x: … Test aborted}, with the one informative part discarded, and a
     * single unmet precondition turned the whole report red.
     *
     * <p>Containers report too. A class that a condition disabled, or whose {@code @BeforeAll} threw or
     * assumed itself away, produced no line at all here, so a whole class could leave the report without
     * trace — which is how the External API suite disappears when no key is configured.
     */
    @Override
    public void executionFinished(TestIdentifier testIdentifier, TestExecutionResult testExecutionResult) {
        switch (testExecutionResult.getStatus()) {
            case SUCCESSFUL -> {
                if (testIdentifier.isTest()) {
                    testsSucceeded.incrementAndGet();
                    testResults.add(":white_check_mark: " + testIdentifier.getDisplayName());
                }
            }
            case FAILED -> {
                testsFailed.incrementAndGet();
                testResults.add(":x: " + describe(testIdentifier) + ": " + failureMessage(testExecutionResult));
            }
            case ABORTED -> {
                testsSkipped.addAndGet(caseCount(testIdentifier));
                testResults.add(":fast_forward: " + describe(testIdentifier) + ": " + abortReason(testExecutionResult));
            }
        }
    }

    @Override
    public void executionSkipped(TestIdentifier testIdentifier, String reason) {
        testsSkipped.addAndGet(caseCount(testIdentifier));
        String skipReason = truncateMessage(skipReason(reason));
        testResults.add(":fast_forward: " + describe(testIdentifier) + ": " + skipReason);
        log.info("Skipped {}: {}", describe(testIdentifier), skipReason);
    }

    /**
     * How many cases this outcome accounts for: one for a test, and for a class the number of cases that
     * never ran with it. Counting the descendants is what keeps the report's totals reconcilable against
     * the runner's "Start execution of N tests", which is the only inventory anyone sees before a run.
     */
    private int caseCount(TestIdentifier testIdentifier) {
        if (testIdentifier.isTest()) {
            return 1;
        }
        TestPlan plan = this.testPlan;
        return plan == null ? 0 : (int) plan.getDescendants(testIdentifier).stream()
                .filter(TestIdentifier::isTest)
                .count();
    }

    private String describe(TestIdentifier testIdentifier) {
        if (testIdentifier.isTest()) {
            return testIdentifier.getDisplayName();
        }
        int cases = caseCount(testIdentifier);
        return cases > 0
                ? testIdentifier.getDisplayName() + " (" + cases + " cases)"
                : testIdentifier.getDisplayName();
    }

    private static String failureMessage(TestExecutionResult result) {
        return result.getThrowable()
                .map(Throwable::getMessage)
                .map(SlackListener::truncateMessage)
                .orElse("Unknown error");
    }

    /**
     * {@code Assumptions.assumeTrue(condition, message)} throws with {@code "Assumption failed: "} in front
     * of the message the test author wrote. Strip it — the rest is the sentence worth reading.
     */
    private static String abortReason(TestExecutionResult result) {
        return result.getThrowable()
                .map(Throwable::getMessage)
                .map(message -> message.startsWith(ASSUMPTION_PREFIX)
                        ? message.substring(ASSUMPTION_PREFIX.length())
                        : message)
                .map(SlackListener::truncateMessage)
                .filter(message -> !message.isBlank())
                .orElse("Test aborted");
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
        int passed = testsSucceeded.get();
        int failed = testsFailed.get();
        int skipped = testsSkipped.get();

        StringBuilder summary = new StringBuilder();
        summary.append("*Test Report*").append(header(passed, failed, skipped)).append("\n\n");
        summary.append(String.format("Environment: %s\n", env));
        summary.append(String.format("Tag: %s\n", tag));
        summary.append(String.format("Passed %d · Failed %d · Skipped %d", passed, failed, skipped));

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

    /**
     * Three states, not two. "Nothing failed" and "nothing ran" are different things: a phase where every
     * case skipped means the tenant did not hold what the suite needed, and reporting that green would hide
     * exactly the condition this listener exists to surface.
     */
    private static String header(int passed, int failed, int skipped) {
        if (failed > 0) {
            return " :red_circle:";
        }
        if (passed > 0) {
            return " :large_green_circle:";
        }
        return skipped > 0 ? " :large_yellow_circle:" : " :red_circle:";
    }
}
