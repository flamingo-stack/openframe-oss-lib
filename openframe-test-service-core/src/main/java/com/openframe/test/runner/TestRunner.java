package com.openframe.test.runner;

import lombok.extern.slf4j.Slf4j;
import org.junit.platform.engine.TestTag;
import org.junit.platform.engine.discovery.ClassSelector;
import org.junit.platform.launcher.Launcher;
import org.junit.platform.launcher.LauncherDiscoveryRequest;
import org.junit.platform.launcher.TestIdentifier;
import org.junit.platform.launcher.TestPlan;
import org.junit.platform.launcher.core.LauncherDiscoveryRequestBuilder;
import org.junit.platform.launcher.core.LauncherFactory;

import java.net.JarURLConnection;
import java.net.URL;
import java.net.URLConnection;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.List;
import java.util.jar.JarEntry;
import java.util.jar.JarFile;
import java.util.stream.Collectors;

import static org.junit.platform.engine.discovery.DiscoverySelectors.selectClass;
import static org.junit.platform.engine.discovery.DiscoverySelectors.selectPackage;
import static org.junit.platform.launcher.TagFilter.excludeTags;
import static org.junit.platform.launcher.TagFilter.includeTags;

@Slf4j
public class TestRunner {

    /** One test at a time — the historical behaviour, and the default for every existing caller. */
    public static final int SEQUENTIAL = 1;

    private final TestRunnerConfig config;
    private final Launcher launcher;

    public TestRunner(TestRunnerConfig config) {
        this.config = config;
        this.launcher = LauncherFactory.create();
        this.launcher.registerTestExecutionListeners(this.config.getTestListeners());
    }

    public void run(String... tags) {
        run(buildRequest(tags));
    }

    public void run(LauncherDiscoveryRequest request) {
        run(discover(request));
    }

    public void run(TestPlan testPlan) {
        launcher.execute(testPlan);
    }

    public TestPlan discover(String... tags) {
        return discover(buildRequest(tags));
    }

    public TestPlan discover(String[] includeTags, String[] excludeTags) {
        return discover(includeTags, excludeTags, SEQUENTIAL);
    }

    /**
     * Discovers a plan that runs up to {@code parallelism} test <em>classes</em> at once.
     *
     * <p>Methods within a class still run one at a time, on the class's own thread, so a class whose
     * cases build on each other (create then find) is unaffected — and {@code @BeforeAll} runs on the
     * same thread its tests will use, which the ThreadLocal auth session depends on.
     *
     * <p>Worth it where per-test latency dominates and the work is I/O-bound: the AI assistant suite
     * spends ~30s per case waiting on a model, so it is almost entirely idle. Speedup is capped by the
     * slowest single class, not by the thread count.
     *
     * <p><b>Only for suites whose cases are isolated from each other.</b> The AI cases qualify — every
     * artifact they create is namespaced by {@link com.openframe.test.helpers.ai.RunId} and each holds
     * its own {@code AgentSession} — but a suite sharing fixtures or driving one browser does not.
     * Callers opt in per phase rather than this being switched on globally.
     *
     * @param parallelism max concurrent classes; {@link #SEQUENTIAL} (or less) keeps the old behaviour
     */
    public TestPlan discover(String[] includeTags, String[] excludeTags, int parallelism) {
        return discover(buildRequest(includeTags, excludeTags, parallelism));
    }

    public TestPlan discover(LauncherDiscoveryRequest request) {
        return launcher.discover(request);
    }

    private LauncherDiscoveryRequest buildRequest(String... tags) {
        return buildRequest(tags, new String[0], SEQUENTIAL);
    }

    private LauncherDiscoveryRequest buildRequest(String[] include, String[] exclude, int parallelism) {
        List<ClassSelector> classSelectors = discoverTestClasses();
        LauncherDiscoveryRequestBuilder builder = LauncherDiscoveryRequestBuilder.request();
        applyParallelism(builder, parallelism);
        if (include != null && include.length > 0) {
            builder.filters(includeTags(include));
        }
        if (exclude != null && exclude.length > 0) {
            log.info("Excluding tags: {}", String.join(", ", exclude));
            builder.filters(excludeTags(exclude));
        }
        if (!classSelectors.isEmpty()) {
            log.info("Discovered {} test classes via classpath scanning", classSelectors.size());
            builder.selectors(classSelectors);
        } else {
            log.info("Falling back to selectPackage({})", config.getTestPackage());
            builder.selectors(selectPackage(this.config.getTestPackage()));
        }
        return builder.build();
    }

    /**
     * Sets the parallel-execution parameters on the discovery request. They are read again at
     * execution time from the plan this request produces, so {@code run(TestPlan)} honours them —
     * discovery and execution do not have to share a call.
     *
     * <p>{@code mode.default=same_thread} with {@code mode.classes.default=concurrent} is the pairing
     * that gives concurrency between classes and none inside one. Leaving {@code mode.default} at its
     * {@code same_thread} default is not enough on its own: without setting both explicitly the
     * intent is invisible to the next reader, and flipping either one alone changes which of the two
     * levels runs concurrently.
     */
    private void applyParallelism(LauncherDiscoveryRequestBuilder builder, int parallelism) {
        if (parallelism <= SEQUENTIAL) {
            return;
        }
        log.info("Parallel execution enabled: up to {} test classes at once", parallelism);
        builder.configurationParameter("junit.jupiter.execution.parallel.enabled", "true")
                .configurationParameter("junit.jupiter.execution.parallel.mode.default", "same_thread")
                .configurationParameter("junit.jupiter.execution.parallel.mode.classes.default", "concurrent")
                .configurationParameter("junit.jupiter.execution.parallel.config.strategy", "fixed")
                .configurationParameter("junit.jupiter.execution.parallel.config.fixed.parallelism",
                        String.valueOf(parallelism));
    }

    private List<ClassSelector> discoverTestClasses() {
        String packagePath = config.getTestPackage().replace('.', '/');
        ClassLoader cl = Thread.currentThread().getContextClassLoader();
        List<ClassSelector> selectors = new ArrayList<>();

        try {
            Enumeration<URL> resources = cl.getResources(packagePath);
            while (resources.hasMoreElements()) {
                URL url = resources.nextElement();
                log.info("Scanning resource URL: {} (protocol: {})", url, url.getProtocol());
                try {
                    URLConnection conn = url.openConnection();
                    if (conn instanceof JarURLConnection jarConn) {
                        JarFile jarFile = jarConn.getJarFile();
                        Enumeration<JarEntry> entries = jarFile.entries();
                        while (entries.hasMoreElements()) {
                            JarEntry entry = entries.nextElement();
                            String name = entry.getName();
                            if (name.startsWith(packagePath + "/") && name.endsWith(".class") && !name.contains("$")) {
                                String className = name.replace('/', '.').replace(".class", "");
                                try {
                                    Class<?> clazz = cl.loadClass(className);
                                    selectors.add(selectClass(clazz));
                                    log.info("Discovered test class: {}", className);
                                } catch (ClassNotFoundException | NoClassDefFoundError e) {
                                    log.warn("Could not load class: {}", className);
                                }
                            }
                        }
                    } else {
                        log.info("URLConnection type: {}", conn.getClass().getName());
                    }
                } catch (Exception e) {
                    log.warn("Failed to scan URL: {} - {}", url, e.getMessage());
                }
            }
        } catch (Exception e) {
            log.warn("Failed to scan classpath for test classes", e);
        }

        return selectors;
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
