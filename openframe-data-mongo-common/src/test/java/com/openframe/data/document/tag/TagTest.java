package com.openframe.data.document.tag;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class TagTest {

    @Test
    void builder_noVersionGiven_versionStartsAtZero() {
        // execution
        Tag tag = Tag.builder().key("site").build();

        // verifications
        assertThat(tag.getVersion()).isZero();
    }

    @Test
    void noArgsConstructor_asSpringDataReadsAStoredTagWithoutVersion_versionStartsAtZero() {
        // execution
        Tag tag = new Tag();

        // verifications
        assertThat(tag.getVersion()).isZero();
    }
}
