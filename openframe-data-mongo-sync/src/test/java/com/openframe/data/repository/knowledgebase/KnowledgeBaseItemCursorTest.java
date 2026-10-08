package com.openframe.data.repository.knowledgebase;

import com.openframe.data.document.knowledgebase.KnowledgeBaseItem;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItemType;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;

class KnowledgeBaseItemCursorTest {

    private static final String ID = "65f000000000000000000001";

    @Test
    @DisplayName("a folder cursor carries the name through serialize and parse, separators included")
    void folderCursorRoundTrips() {
        KnowledgeBaseItem folder = KnowledgeBaseItem.builder()
                .id(ID)
                .type(KnowledgeBaseItemType.FOLDER)
                .name("VPN: setup: part 2")
                .build();

        KnowledgeBaseItemCursor parsed = KnowledgeBaseItemCursor.parse(KnowledgeBaseItemCursor.of(folder).serialize());

        assertThat(parsed).isEqualTo(
                new KnowledgeBaseItemCursor(KnowledgeBaseItemType.FOLDER, ID, "VPN: setup: part 2", null));
    }

    @Test
    @DisplayName("whatever the folder is called, the base64 cursor survives an unencoded query string")
    void folderCursorIsQueryStringSafe() {
        String name = "QA>Prod? ~ +/ \u0442\u0435\u0441\u0442";
        KnowledgeBaseItem folder = KnowledgeBaseItem.builder()
                .id(ID)
                .type(KnowledgeBaseItemType.FOLDER)
                .name(name)
                .build();

        String serialized = KnowledgeBaseItemCursor.of(folder).serialize();
        String opaque = Base64.getEncoder().encodeToString(serialized.getBytes(StandardCharsets.UTF_8));

        assertThat(opaque).doesNotContain("+", "/");
        assertThat(KnowledgeBaseItemCursor.parse(serialized).name()).isEqualTo(name);
    }

    @Test
    @DisplayName("an article cursor carries updatedAt to the millisecond")
    void articleCursorRoundTrips() {
        Instant updatedAt = Instant.ofEpochMilli(1_760_000_000_123L);
        KnowledgeBaseItem article = KnowledgeBaseItem.builder()
                .id(ID)
                .type(KnowledgeBaseItemType.ARTICLE)
                .name("How to reset a password")
                .updatedAt(updatedAt)
                .build();

        KnowledgeBaseItemCursor parsed = KnowledgeBaseItemCursor.parse(KnowledgeBaseItemCursor.of(article).serialize());

        assertThat(parsed).isEqualTo(new KnowledgeBaseItemCursor(KnowledgeBaseItemType.ARTICLE, ID, null, updatedAt));
    }

    @Test
    @DisplayName("an article without updatedAt keeps its stream and id")
    void articleCursorWithoutSortValue() {
        KnowledgeBaseItem article = KnowledgeBaseItem.builder()
                .id(ID)
                .type(KnowledgeBaseItemType.ARTICLE)
                .name("Draft")
                .build();

        KnowledgeBaseItemCursor parsed = KnowledgeBaseItemCursor.parse(KnowledgeBaseItemCursor.of(article).serialize());

        assertThat(parsed).isEqualTo(new KnowledgeBaseItemCursor(KnowledgeBaseItemType.ARTICLE, ID, null, null));
    }

    @Test
    @DisplayName("a bare id, an unknown tag and null are not tagged cursors")
    void untaggedInputIsNotParsed() {
        assertThat(KnowledgeBaseItemCursor.parse(ID)).isNull();
        assertThat(KnowledgeBaseItemCursor.parse("X:" + ID + ":1")).isNull();
        assertThat(KnowledgeBaseItemCursor.parse(null)).isNull();
    }
}
