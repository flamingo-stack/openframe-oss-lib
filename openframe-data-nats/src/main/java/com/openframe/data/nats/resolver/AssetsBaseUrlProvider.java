package com.openframe.data.nats.resolver;

/**
 * Supplies the base URL substituted for the {@code {assetsBaseUrl}} placeholder in download link
 * templates. No implementation is provided in this library: when no bean is present,
 * {@link DownloadConfigurationLinkResolver} falls back to the static
 * {@code openframe.assets.base-url} property. Downstream deployments contribute a bean to resolve
 * the base URL dynamically (e.g. the SaaS tenant plane derives it from the tenant's domain).
 */
public interface AssetsBaseUrlProvider {

    /**
     * @return the assets base URL (e.g. {@code https://tenant1.openframe.build}), or blank/null to
     * defer to the {@code openframe.assets.base-url} property
     */
    String getAssetsBaseUrl();
}
