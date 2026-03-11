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
import static org.junit.platform.launcher.TagFilter.includeTags;

@Slf4j
public class TestRunner {

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

    public TestPlan discover(LauncherDiscoveryRequest request) {
        return launcher.discover(request);
    }

    private LauncherDiscoveryRequest buildRequest(String... tags) {
        List<ClassSelector> classSelectors = discoverTestClasses();
        LauncherDiscoveryRequestBuilder builder = LauncherDiscoveryRequestBuilder.request()
                .filters(includeTags(tags));
        if (!classSelectors.isEmpty()) {
            log.info("Discovered {} test classes via classpath scanning", classSelectors.size());
            builder.selectors(classSelectors);
        } else {
            log.info("Falling back to selectPackage({})", config.getTestPackage());
            builder.selectors(selectPackage(this.config.getTestPackage()));
        }
        return builder.build();
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
