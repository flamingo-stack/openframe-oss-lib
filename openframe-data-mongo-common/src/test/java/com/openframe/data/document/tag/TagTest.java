package com.openframe.data.document.tag;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class TagTest {

    @Test
    void builder_noVersionGiven_versionNullSoTheSaveInserts() {
        // execution
        Tag tag = Tag.builder().key("site").build();

        // verifications
        assertThat(tag.getVersion()).isNull();
    }

    @Test
    void noArgsConstructor_noVersionGiven_versionNullSoTheSaveInserts() {
        // execution
        Tag tag = new Tag();

        // verifications
        assertThat(tag.getVersion()).isNull();
    }
}
