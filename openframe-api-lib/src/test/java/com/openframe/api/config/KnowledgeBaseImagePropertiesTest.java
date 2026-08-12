package com.openframe.api.config;

import com.openframe.api.config.KnowledgeBaseImageProperties.AllowedType;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.env.PropertySource;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.core.io.ByteArrayResource;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Guards the exact YAML shape deployments have to write, and the override semantics that shape
 * was chosen for: a configured list must REPLACE what came before it, so an environment can drop
 * a type and not merely add one.
 */
class KnowledgeBaseImagePropertiesTest {

    @Test
    @DisplayName("defaults are usable with no configuration at all")
    void defaults() {
        KnowledgeBaseImageProperties properties = new KnowledgeBaseImageProperties();

        assertThat(contentTypes(properties)).containsExactly("image/jpeg", "image/png", "image/webp");
        assertThat(properties.getMaxSizeBytes()).isEqualTo(10 * 1024 * 1024);
        assertThat(properties.getUploadUrlExpirationMinutes()).isEqualTo(15);
        assertThat(properties.getDownloadUrlExpirationMinutes()).isEqualTo(1440);
    }

    @Test
    @DisplayName("the deployed YAML shape binds")
    void bindsFromYaml() throws IOException {
        KnowledgeBaseImageProperties properties = bind("""
                openframe:
                  kb:
                    images:
                      max-size-bytes: 5242880
                      download-url-expiration-minutes: 720
                      allowed-types:
                        - content-type: image/jpeg
                          extension: jpg
                        - content-type: image/png
                          extension: png
                        - content-type: image/webp
                          extension: webp
                """);

        assertThat(contentTypes(properties)).containsExactly("image/jpeg", "image/png", "image/webp");
        assertThat(properties.getAllowedTypes().get(0).getExtension()).isEqualTo("jpg");
        assertThat(properties.getMaxSizeBytes()).isEqualTo(5_242_880L);
        assertThat(properties.getDownloadUrlExpirationMinutes()).isEqualTo(720);
    }

    @Test
    @DisplayName("a configured list replaces the code defaults rather than adding to them")
    void configuredListReplacesDefaults() throws IOException {
        KnowledgeBaseImageProperties properties = bind("""
                openframe:
                  kb:
                    images:
                      allowed-types:
                        - content-type: image/gif
                          extension: gif
                """);

        assertThat(contentTypes(properties)).containsExactly("image/gif");
    }

    @Test
    @DisplayName("a per-environment override replaces the base list, so an env can drop a type")
    void environmentOverrideReplacesBase() throws IOException {
        StandardEnvironment environment = new StandardEnvironment();
        addYaml(environment, """
                openframe:
                  kb:
                    images:
                      allowed-types:
                        - content-type: image/jpeg
                          extension: jpg
                        - content-type: image/gif
                          extension: gif
                """);
        // higher priority, as a dev profile overlay would be
        addYaml(environment, """
                openframe:
                  kb:
                    images:
                      allowed-types:
                        - content-type: image/jpeg
                          extension: jpg
                """);

        KnowledgeBaseImageProperties properties = Binder.get(environment)
                .bind("openframe.kb.images", KnowledgeBaseImageProperties.class)
                .orElseGet(KnowledgeBaseImageProperties::new);

        assertThat(contentTypes(properties)).containsExactly("image/jpeg");
    }

    private static List<String> contentTypes(KnowledgeBaseImageProperties properties) {
        return properties.getAllowedTypes().stream().map(AllowedType::getContentType).toList();
    }

    private KnowledgeBaseImageProperties bind(String yaml) throws IOException {
        StandardEnvironment environment = new StandardEnvironment();
        addYaml(environment, yaml);

        return Binder.get(environment)
                .bind("openframe.kb.images", KnowledgeBaseImageProperties.class)
                .orElseGet(KnowledgeBaseImageProperties::new);
    }

    private void addYaml(StandardEnvironment environment, String yaml) throws IOException {
        List<PropertySource<?>> sources = new YamlPropertySourceLoader()
                .load("test-" + environment.getPropertySources().size(),
                        new ByteArrayResource(yaml.getBytes(StandardCharsets.UTF_8)));
        sources.forEach(source -> environment.getPropertySources().addFirst(source));
    }
}
