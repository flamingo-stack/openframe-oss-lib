package com.openframe.data.config;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.junit.jupiter.api.Assertions.assertThrows;

class PackageManagerPropertiesTest {

    private static final String FEED_URL = "https://feed.openframe.build/choco/index.json";
    private static final String VERSION = "2.7.5";
    private static final String SHA256 = "f86f99a18d236c2f99e6f67a20be7adc65c6c7756bf6cf3b43759e7ec0aa5839";

    private PackageManagerProperties properties;

    @BeforeEach
    void setUp() {
        properties = new PackageManagerProperties();
    }

    @ParameterizedTest
    @MethodSource("blankChocoValues")
    void validate_chocoEnabledBlankFeedVersionOrSha_throwsIllegalState(String feedUrl, String version, String sha256) {
        // setup
        properties.setChocoEnabled(true);
        properties.getChoco().setFeedUrl(feedUrl);
        properties.getChoco().setVersion(version);
        properties.getChoco().setSha256(sha256);

        // execution
        IllegalStateException ex = assertThrows(IllegalStateException.class, properties::validate);

        // verifications
        assertThat(ex.getMessage()).containsIgnoringCase("choco");
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "http://feed/choco/index.json", "https://feed/choco/", "https://feed/choco/v3.json"})
    void validate_chocoEnabledFeedUrlNotAnHttpsIndexJson_throwsIllegalState(String feedUrl) {
        // setup
        properties.setChocoEnabled(true);
        properties.getChoco().setFeedUrl(feedUrl);
        properties.getChoco().setVersion(VERSION);
        properties.getChoco().setSha256(SHA256);

        // execution
        IllegalStateException ex = assertThrows(IllegalStateException.class, properties::validate);

        // verifications
        assertThat(ex.getMessage()).containsIgnoringCase("choco").contains("feed-url");
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "http://feed/choco/index.json", "https://feed/choco/", "https://feed/choco/v3.json"})
    void validate_chocoDisabledFeedUrlNotAnHttpsIndexJson_passes(String feedUrl) {
        // setup
        properties.setChocoEnabled(false);
        properties.getChoco().setFeedUrl(feedUrl);
        properties.getChoco().setVersion(VERSION);
        properties.getChoco().setSha256(SHA256);

        // execution
        Throwable thrown = catchThrowable(properties::validate);

        // verifications
        assertThat(thrown).isNull();
    }

    @Test
    void validate_chocoEnabledAllValuesSet_passes() {
        // setup
        properties.setChocoEnabled(true);
        properties.getChoco().setFeedUrl(FEED_URL);
        properties.getChoco().setVersion(VERSION);
        properties.getChoco().setSha256(SHA256);

        // execution
        Throwable thrown = catchThrowable(properties::validate);

        // verifications
        assertThat(thrown).isNull();
    }

    @Test
    void validate_chocoDisabledBlankValues_passes() {
        // setup
        properties.setChocoEnabled(false);
        properties.getChoco().setFeedUrl(" ");
        properties.getChoco().setVersion("");
        properties.getChoco().setSha256(null);

        // execution
        Throwable thrown = catchThrowable(properties::validate);

        // verifications
        assertThat(thrown).isNull();
    }

    @Test
    void validate_defaultsWithChocoDisabled_passes() {
        // execution
        Throwable thrown = catchThrowable(properties::validate);

        // verifications
        assertThat(thrown).isNull();
    }

    @Test
    void getChoco_defaults_noValuesSet() {
        // execution
        PackageManagerProperties.Choco choco = properties.getChoco();

        // verifications
        assertThat(choco)
                .extracting(PackageManagerProperties.Choco::getFeedUrl, PackageManagerProperties.Choco::getVersion,
                        PackageManagerProperties.Choco::getSha256)
                .containsOnlyNulls();
    }

    private static Stream<Arguments> blankChocoValues() {
        return Stream.of(
                Arguments.of(null, VERSION, SHA256),
                Arguments.of("", VERSION, SHA256),
                Arguments.of(" ", VERSION, SHA256),
                Arguments.of(FEED_URL, null, SHA256),
                Arguments.of(FEED_URL, "", SHA256),
                Arguments.of(FEED_URL, " ", SHA256),
                Arguments.of(FEED_URL, VERSION, null),
                Arguments.of(FEED_URL, VERSION, ""),
                Arguments.of(FEED_URL, VERSION, " ")
        );
    }
}
