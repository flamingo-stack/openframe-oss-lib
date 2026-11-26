package com.openframe.api.datafetcher;

import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.knowledgebase.KnowledgeBaseCursors;
import com.openframe.api.dto.knowledgebase.KnowledgeBaseFilterCriteria;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.mapper.GraphQLKnowledgeBaseMapper;
import com.openframe.api.service.knowledgebase.KnowledgeBaseAttachmentService;
import com.openframe.api.service.knowledgebase.KnowledgeBaseService;
import com.openframe.api.service.knowledgebase.KnowledgeBaseTagService;
import com.openframe.api.service.knowledgebase.KnowledgeBaseTempAttachmentService;
import com.openframe.core.exception.InvalidCursorException;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItem;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItemType;
import com.openframe.graphql.relay.NodeType;
import com.openframe.graphql.relay.RelayIdCodec;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class KnowledgeBaseDataFetcherPagingTest {

    private static final String FOLDER_POSITION = "F:65f1a2b3c4d5e6f708192a10:Networking";
    private static final String ARTICLE_POSITION = "A:65f1a2b3c4d5e6f708192b20:1760000000123";
    private static final String ARTICLE_ID = "65f1a2b3c4d5e6f708192b20";
    private static final Instant UPDATED_AT = Instant.ofEpochMilli(1_760_000_000_123L);
    private static final String SEARCH = "vpn";
    private static final String RAW_TAG_ID = "tag-1";
    private static final String NOT_BASE64 = "not base64!";
    private static final String INVALID_CURSOR = "Invalid cursor";
    private static final KnowledgeBaseFilterCriteria NO_FILTER = KnowledgeBaseFilterCriteria.builder().build();

    @Mock private KnowledgeBaseService knowledgeBaseService;
    @Mock private KnowledgeBaseTagService knowledgeBaseTagService;
    @Mock private KnowledgeBaseTempAttachmentService knowledgeBaseTempAttachmentService;
    @Mock private KnowledgeBaseAttachmentService knowledgeBaseAttachmentService;
    @Spy private RelayIdCodec relayIdCodec = new RelayIdCodec();
    @Spy private GraphQLKnowledgeBaseMapper mapper = new GraphQLKnowledgeBaseMapper(new RelayIdCodec());

    @InjectMocks private KnowledgeBaseDataFetcher dataFetcher;

    @Test
    void knowledgeBaseItems_lastAndBeforeNextToFirstAndAfter_backwardPageBeforeTheDecodedCursorReachesTheService() {
        // setup
        String after = CursorCodec.encode(FOLDER_POSITION);
        String before = CursorCodec.encode(ARTICLE_POSITION);
        CursorPaginationCriteria backwardPage = CursorPaginationCriteria.builder()
                .limit(5)
                .cursor(ARTICLE_POSITION)
                .backward(true)
                .build();
        CountedGenericQueryResult<KnowledgeBaseItem> noItems = page(List.of());
        when(knowledgeBaseService.queryItems(NO_FILTER, SEARCH, backwardPage)).thenReturn(noItems);

        // execution
        dataFetcher.knowledgeBaseItems(null, SEARCH, 10, after, 5, before);

        // verifications
        verify(knowledgeBaseService).queryItems(NO_FILTER, SEARCH, backwardPage);
    }

    @Test
    void knowledgeBaseItems_lastWithoutBefore_backwardPageWithoutACursorReachesTheService() {
        // setup
        CursorPaginationCriteria lastPage = CursorPaginationCriteria.builder().limit(5).backward(true).build();
        CountedGenericQueryResult<KnowledgeBaseItem> noItems = page(List.of());
        when(knowledgeBaseService.queryItems(NO_FILTER, null, lastPage)).thenReturn(noItems);

        // execution
        dataFetcher.knowledgeBaseItems(null, null, null, null, 5, null);

        // verifications
        verify(knowledgeBaseService).queryItems(NO_FILTER, null, lastPage);
    }

    @Test
    void knowledgeBaseItems_firstAndAfter_forwardPageAfterTheDecodedCursorReachesTheService() {
        // setup
        String after = CursorCodec.encode(FOLDER_POSITION);
        CursorPaginationCriteria forwardPage = CursorPaginationCriteria.builder().limit(10).cursor(FOLDER_POSITION).build();
        CountedGenericQueryResult<KnowledgeBaseItem> noItems = page(List.of());
        when(knowledgeBaseService.queryItems(NO_FILTER, null, forwardPage)).thenReturn(noItems);

        // execution
        dataFetcher.knowledgeBaseItems(null, null, 10, after, null, null);

        // verifications
        verify(knowledgeBaseService).queryItems(NO_FILTER, null, forwardPage);
    }

    @Test
    void knowledgeBaseItems_beforeThatIsNotBase64_throwsInvalidCursorWithoutCallingTheService() {
        // setup
        String before = NOT_BASE64;

        // execution
        Throwable thrown = catchThrowable(() -> dataFetcher.knowledgeBaseItems(null, null, null, null, 5, before));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage(INVALID_CURSOR);
        verifyNoInteractions(knowledgeBaseService);
    }

    @Test
    void knowledgeBaseItems_backwardPage_edgeCursorsKeepTheFormatOfThePageInfoCursors() {
        // setup
        KnowledgeBaseItem article = KnowledgeBaseItem.builder()
                .id(ARTICLE_ID)
                .type(KnowledgeBaseItemType.ARTICLE)
                .updatedAt(UPDATED_AT)
                .build();
        String articleCursor = KnowledgeBaseCursors.encode(article);
        CursorPaginationCriteria lastPage = CursorPaginationCriteria.builder().limit(5).backward(true).build();
        CountedGenericQueryResult<KnowledgeBaseItem> oneArticle = page(List.of(article));
        when(knowledgeBaseService.queryItems(NO_FILTER, null, lastPage)).thenReturn(oneArticle);

        // execution
        CountedGenericConnection<GenericEdge<KnowledgeBaseItem>> connection =
                dataFetcher.knowledgeBaseItems(null, null, null, null, 5, null);

        // verifications
        assertThat(CursorCodec.decode(articleCursor)).isEqualTo(ARTICLE_POSITION);
        assertThat(connection.getEdges()).extracting(GenericEdge::getCursor).containsExactly(articleCursor);
    }

    @Test
    void archivedArticles_lastAndBeforeNextToFirstAndAfter_backwardPageBeforeTheDecodedCursorReachesTheService() {
        // setup
        String tagId = relayIdCodec.encode(NodeType.TAG, RAW_TAG_ID);
        List<String> tagIds = List.of(tagId);
        List<String> rawTagIds = List.of(RAW_TAG_ID);
        String after = CursorCodec.encode(FOLDER_POSITION);
        String before = CursorCodec.encode(ARTICLE_POSITION);
        CursorPaginationCriteria backwardPage = CursorPaginationCriteria.builder()
                .limit(5)
                .cursor(ARTICLE_POSITION)
                .backward(true)
                .build();
        CountedGenericQueryResult<KnowledgeBaseItem> noItems = page(List.of());
        when(knowledgeBaseService.queryArchivedArticles(SEARCH, rawTagIds, backwardPage)).thenReturn(noItems);

        // execution
        dataFetcher.archivedArticles(SEARCH, tagIds, 10, after, 5, before);

        // verifications
        verify(knowledgeBaseService).queryArchivedArticles(SEARCH, rawTagIds, backwardPage);
    }

    @Test
    void archivedArticles_lastWithoutBefore_backwardPageWithoutACursorReachesTheService() {
        // setup
        CursorPaginationCriteria lastPage = CursorPaginationCriteria.builder().limit(5).backward(true).build();
        CountedGenericQueryResult<KnowledgeBaseItem> noItems = page(List.of());
        when(knowledgeBaseService.queryArchivedArticles(null, null, lastPage)).thenReturn(noItems);

        // execution
        dataFetcher.archivedArticles(null, null, null, null, 5, null);

        // verifications
        verify(knowledgeBaseService).queryArchivedArticles(null, null, lastPage);
    }

    @Test
    void archivedArticles_firstAndAfter_forwardPageAfterTheDecodedCursorReachesTheService() {
        // setup
        String after = CursorCodec.encode(ARTICLE_POSITION);
        CursorPaginationCriteria forwardPage = CursorPaginationCriteria.builder().limit(10).cursor(ARTICLE_POSITION).build();
        CountedGenericQueryResult<KnowledgeBaseItem> noItems = page(List.of());
        when(knowledgeBaseService.queryArchivedArticles(null, null, forwardPage)).thenReturn(noItems);

        // execution
        dataFetcher.archivedArticles(null, null, 10, after, null, null);

        // verifications
        verify(knowledgeBaseService).queryArchivedArticles(null, null, forwardPage);
    }

    @Test
    void archivedArticles_beforeThatIsNotBase64_throwsInvalidCursorWithoutCallingTheService() {
        // setup
        String before = NOT_BASE64;

        // execution
        Throwable thrown = catchThrowable(() -> dataFetcher.archivedArticles(null, null, null, null, 5, before));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage(INVALID_CURSOR);
        verifyNoInteractions(knowledgeBaseService);
    }

    private static CountedGenericQueryResult<KnowledgeBaseItem> page(List<KnowledgeBaseItem> items) {
        return CountedGenericQueryResult.<KnowledgeBaseItem>builder()
                .items(items)
                .pageInfo(PageInfo.builder().build())
                .filteredCount(items.size())
                .build();
    }
}
