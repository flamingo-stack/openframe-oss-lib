package com.openframe.test.helpers;

import com.openframe.test.config.ExternalApiConfig;
import org.junit.jupiter.api.extension.BeforeAllCallback;
import org.junit.jupiter.api.extension.ExtensionContext;
import org.junit.jupiter.api.extension.ExtensionContext.Namespace;
import org.junit.jupiter.api.extension.ExtensionContext.Store.CloseableResource;

/**
 * Deletes the API key the External API suite minted for itself, once the whole run is over.
 *
 * <p>The key is minted lazily by {@link ExternalApiConfig#getApiKey()}; this extension exists purely to
 * own the other half of that lifecycle. It registers a {@link CloseableResource} in the <em>root</em>
 * {@link ExtensionContext} store, so cleanup runs once per launcher execution and only after the last
 * class has finished — not once per class, which is what a {@code @AfterAll} on the base class would
 * give, and which would delete the key out from under any class still running in parallel.
 *
 * <p>A JVM shutdown hook was the obvious alternative and is the wrong tool here: the downstream runner
 * service drives the JUnit {@code Launcher} in-process in a long-lived Spring application, so its JVM
 * does not exit between runs and a hook would never fire — every run would leak its key. The root store
 * closes at the end of each {@code launcher.execute(...)}, which is exactly the intended scope under
 * both surefire and the runner.
 *
 * <p>Registered on {@link com.openframe.test.tests.external.ExternalApiBaseTest}. Unlike
 * {@code @EnabledIf}, {@code @ExtendWith} <em>is</em> {@code @Inherited}, so declaring it on the base
 * class is enough and each concrete class does not have to repeat it.
 */
public class ExternalApiKeyExtension implements BeforeAllCallback {

    private static final Namespace NAMESPACE = Namespace.create(ExternalApiKeyExtension.class);
    private static final String CLEANUP_KEY = "provisioned-external-api-key";

    @Override
    public void beforeAll(ExtensionContext context) {
        // getOrComputeIfAbsent on the root store is atomic, so concurrent classes register one resource
        // between them rather than one each.
        context.getRoot()
                .getStore(NAMESPACE)
                .getOrComputeIfAbsent(CLEANUP_KEY,
                        key -> (CloseableResource) ExternalApiConfig::releaseProvisionedKey);
    }
}
