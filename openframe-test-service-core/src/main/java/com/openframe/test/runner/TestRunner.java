package com.openframe.test.runner;

import org.junit.platform.engine.TestTag;
import org.junit.platform.launcher.Launcher;
import org.junit.platform.launcher.LauncherDiscoveryRequest;
import org.junit.platform.launcher.TestIdentifier;
import org.junit.platform.launcher.TestPlan;
import org.junit.platform.launcher.core.LauncherDiscoveryRequestBuilder;
import org.junit.platform.launcher.core.LauncherFactory;

import java.util.List;
import java.util.stream.Collectors;

import static org.junit.platform.engine.discovery.DiscoverySelectors.selectPackage;
import static org.junit.platform.launcher.TagFilter.includeTags;

public class TestRunner {

    private final TestRunnerConfig config;
    private final Launcher launcher;

    public TestRunner(TestRunnerConfig config) {
        this.config = config;
        this.launcher = LauncherFactory.create();
        this.launcher.registerTestExecutionListeners(this.config.getTestListeners());
    }

    public void run(String... tags) {
        run(LauncherDiscoveryRequestBuilder.request()
                .selectors(selectPackage(this.config.getTestPackage()))
                .filters(includeTags(tags))
                .build());
    }

    public void run(LauncherDiscoveryRequest request) {
        run(discover(request));
    }

    public void run(TestPlan testPlan) {
        launcher.execute(testPlan);
    }

    public TestPlan discover(String... tags) {
        return discover(LauncherDiscoveryRequestBuilder.request()
                .selectors(selectPackage(this.config.getTestPackage()))
                .filters(includeTags(tags))
                .build());
    }

    public TestPlan discover(LauncherDiscoveryRequest request) {
        return launcher.discover(request);
    }

    public List<Test> list(TestPlan testPlan) {
        return testPlan.getDescendants(testPlan.getRoots().iterator().next()).stream()
                .filter(TestIdentifier::isTest)
                .map(test -> Test.builder()
                        .displayName(test.getDisplayName())
                        .tags(test.getTags().stream()
                                .map(TestTag::getName)
                                .collect(Collectors.toSet()))
                        .build())
                .collect(Collectors.toList());
    }
    
}
