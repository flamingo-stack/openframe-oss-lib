package com.openframe.test.runner;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.junit.platform.launcher.TestExecutionListener;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class TestRunnerConfig {
    private String testPackage;
    private TestExecutionListener[] testListeners;

    public static TestRunnerConfigBuilder builder() {
        return new TestRunnerConfigBuilder();
    }

    public static class TestRunnerConfigBuilder {
        private String testPackage;
        private TestExecutionListener[] testListeners;

        public TestRunnerConfigBuilder testPackage(String testPackage) {
            this.testPackage = testPackage;
            return this;
        }

        public TestRunnerConfigBuilder testListeners(TestExecutionListener... testListeners) {
            this.testListeners = testListeners;
            return this;
        }

        public TestRunnerConfig build() {
            return new TestRunnerConfig(testPackage, testListeners);
        }
    }
}
