package com.openframe.data.document.tenant;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.HashSet;
import java.util.Set;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;

class TenantDisplayIdTest {

    @Test
    void generate_prefixAndEightCrockfordCharacters() {
        String displayId = TenantDisplayId.generate();

        assertThat(displayId).matches("T-[0-9A-HJKMNP-TV-Z]{8}");
    }

    @Test
    void generate_neverUsesTheLettersCrockfordLeavesOut() {
        String drawn = String.join("", IntStream.range(0, 2_000).mapToObj(i -> TenantDisplayId.generate().substring(2)).toList());

        assertThat(drawn).doesNotContain("I", "L", "O", "U");
    }

    @Test
    void generate_manyDraws_areDistinct() {
        Set<String> drawn = new HashSet<>();
        IntStream.range(0, 10_000).forEach(i -> drawn.add(TenantDisplayId.generate()));

        assertThat(drawn).hasSize(10_000);
    }

    @Test
    void isValid_generatedId_isValid() {
        assertThat(TenantDisplayId.isValid(TenantDisplayId.generate())).isTrue();
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"T-7KQ2M9X", "T-7KQ2M9XAB", "t-7KQ2M9XA", "T-7kq2m9xa", "X-7KQ2M9XA", "T-7KQ2M9XI",
            "T-7KQ2M9XO", "8f14e45f-ceea-467a-9575-0f2d4c4a8b1e", "acme.openframe.ai"})
    void isValid_anythingElse_isNotValid(String value) {
        assertThat(TenantDisplayId.isValid(value)).isFalse();
    }
}
