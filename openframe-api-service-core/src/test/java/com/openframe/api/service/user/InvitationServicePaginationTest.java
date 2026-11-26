package com.openframe.api.service.user;

import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.invitation.InvitationResponse;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.mapper.InvitationMapper;
import com.openframe.api.service.processor.InvitationProcessor;
import com.openframe.core.email.EmailDomainPolicy;
import com.openframe.core.exception.InvalidCursorException;
import com.openframe.data.document.user.Invitation;
import com.openframe.data.document.user.InvitationStatus;
import com.openframe.data.document.user.UserRole;
import com.openframe.data.repository.user.InvitationListFilter;
import com.openframe.data.repository.user.InvitationRepository;
import com.openframe.notification.mail.service.EmailService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.junit.jupiter.params.provider.Arguments.arguments;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InvitationServicePaginationTest {

    private static final String INVITATION_1 = "inv-1";
    private static final String INVITATION_2 = "inv-2";
    private static final String INVITATION_3 = "inv-3";
    private static final String INVITATION_4 = "inv-4";
    private static final String INVITATION_5 = "inv-5";
    private static final String INVALID_CURSOR = "Invalid cursor";
    private static final Instant EARLY = Instant.ofEpochMilli(1_750_000_000_000L);
    private static final Instant MIDDLE = EARLY.plusSeconds(60);
    private static final Instant LATE = EARLY.plusSeconds(120);
    private static final Instant EXPIRES_AT = EARLY.plusSeconds(3600);
    private static final InvitationListFilter NO_FILTER = new InvitationListFilter(null, null, null);
    private static final List<String> NEWEST_FIRST =
            List.of(INVITATION_5, INVITATION_4, INVITATION_3, INVITATION_2, INVITATION_1);

    @Mock private InvitationRepository invitationRepository;
    @Mock private EmailService emailService;
    @Mock private UserService userService;
    @Mock private InvitationProcessor invitationProcessor;
    @Mock private EmailDomainPolicy emailDomainPolicy;
    @Spy private InvitationMapper invitationMapper = new InvitationMapper();

    @InjectMocks private InvitationService service;

    @Test
    void queryInvitations_pageOneThenPageTwoThenBeforePageTwo_returnsPageOneAgain() {
        // setup
        stubInvitationPages();

        // execution
        CountedGenericQueryResult<InvitationResponse> pageOne = service.queryInvitations(null, null, forward(2, null));
        CountedGenericQueryResult<InvitationResponse> pageTwo =
                service.queryInvitations(null, null, forward(2, pageOne.getPageInfo().getEndCursor()));
        CountedGenericQueryResult<InvitationResponse> backToPageOne =
                service.queryInvitations(null, null, backward(2, pageTwo.getPageInfo().getStartCursor()));

        // verifications
        assertThat(pageOne.getItems()).extracting(InvitationResponse::getId)
                .containsExactly(INVITATION_5, INVITATION_4);
        assertThat(pageTwo.getItems()).extracting(InvitationResponse::getId)
                .containsExactly(INVITATION_3, INVITATION_2);
        assertThat(backToPageOne.getItems()).extracting(InvitationResponse::getId)
                .containsExactly(INVITATION_5, INVITATION_4);
        assertThat(backToPageOne.getPageInfo())
                .returns(pageOne.getPageInfo().getStartCursor(), PageInfo::getStartCursor)
                .returns(pageOne.getPageInfo().getEndCursor(), PageInfo::getEndCursor);
    }

    @ParameterizedTest
    @MethodSource("pagesOfFiveRows")
    void queryInvitations_eachPageInEachDirection_rowsInDisplayOrderWithBothFlags(
            boolean backward, int anchorRow, List<String> expectedRows, boolean hasPreviousPage, boolean hasNextPage) {
        // setup
        stubInvitationPages();
        String cursor = cursorOfDisplayedRow(anchorRow);
        CursorPaginationCriteria pagination = connectionPage(backward, 2, cursor);

        // execution
        CountedGenericQueryResult<InvitationResponse> result = service.queryInvitations(null, null, pagination);

        // verifications
        assertThat(result.getItems()).extracting(InvitationResponse::getId).containsExactlyElementsOf(expectedRows);
        assertThat(result.getPageInfo())
                .returns(hasPreviousPage, PageInfo::isHasPreviousPage)
                .returns(hasNextPage, PageInfo::isHasNextPage);
    }

    @Test
    void queryInvitations_lastWithoutBefore_lastRowsInDisplayOrderAndNoNextPage() {
        // setup
        stubInvitationPages();

        // execution
        CountedGenericQueryResult<InvitationResponse> result = service.queryInvitations(null, null, backward(2, null));

        // verifications
        assertThat(result.getItems()).extracting(InvitationResponse::getId)
                .containsExactly(INVITATION_2, INVITATION_1);
        assertThat(result.getPageInfo())
                .returns(false, PageInfo::isHasNextPage)
                .returns(true, PageInfo::isHasPreviousPage);
        verify(invitationRepository).findOpenInvitationsPage(
                eq(NO_FILTER), any(Instant.class), isNull(), eq(true), eq(3));
    }

    @Test
    void queryInvitations_backwardPage_pageInfoCursorsKeepTheCreatedAtAndIdFormat() {
        // setup
        stubInvitationPages();

        // execution
        PageInfo pageInfo = service.queryInvitations(null, null, backward(2, null)).getPageInfo();

        // verifications
        assertThat(CursorCodec.decode(pageInfo.getStartCursor())).isEqualTo(EARLY.toEpochMilli() + "_inv-2");
        assertThat(CursorCodec.decode(pageInfo.getEndCursor())).isEqualTo("_inv-1");
    }

    @Test
    void queryInvitations_cursorTheRepositoryRejects_throwsInvalidCursor() {
        // setup
        CursorPaginationCriteria pagination =
                CursorPaginationCriteria.builder().limit(2).cursor("not-an-invitation-cursor").build();
        when(invitationRepository.findOpenInvitationsPage(
                eq(NO_FILTER), any(Instant.class), eq("not-an-invitation-cursor"), eq(false), eq(3)))
                .thenThrow(new InvalidCursorException());

        // execution
        Throwable thrown = catchThrowable(() -> service.queryInvitations(null, null, pagination));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage(INVALID_CURSOR);
    }

    private static Stream<Arguments> pagesOfFiveRows() {
        return Stream.of(
                arguments(false, 0, List.of(INVITATION_5, INVITATION_4), false, true),
                arguments(false, 2, List.of(INVITATION_3, INVITATION_2), true, true),
                arguments(false, 4, List.of(INVITATION_1), true, false),
                arguments(false, 5, List.of(), true, false),
                arguments(true, 0, List.of(INVITATION_2, INVITATION_1), true, false),
                arguments(true, 5, List.of(INVITATION_3, INVITATION_2), true, true),
                arguments(true, 3, List.of(INVITATION_5, INVITATION_4), false, true),
                arguments(true, 2, List.of(INVITATION_5), false, true),
                arguments(true, 1, List.of(), false, true));
    }

    private static CursorPaginationCriteria forward(int first, String after) {
        ConnectionArgs args = ConnectionArgs.builder().first(first).after(after).build();
        return CursorPaginationCriteria.fromConnectionArgs(args);
    }

    private static CursorPaginationCriteria backward(int last, String before) {
        ConnectionArgs args = ConnectionArgs.builder().last(last).before(before).build();
        return CursorPaginationCriteria.fromConnectionArgs(args);
    }

    private static CursorPaginationCriteria connectionPage(boolean backward, int limit, String cursor) {
        return backward ? backward(limit, cursor) : forward(limit, cursor);
    }

    private static List<Invitation> invitations() {
        return List.of(
                invitation(INVITATION_1, null),
                invitation(INVITATION_2, EARLY),
                invitation(INVITATION_3, MIDDLE),
                invitation(INVITATION_4, MIDDLE),
                invitation(INVITATION_5, LATE));
    }

    private static Invitation invitation(String id, Instant createdAt) {
        return Invitation.builder()
                .id(id)
                .email(id + "@acme.io")
                .roles(List.of(UserRole.ADMIN))
                .createdAt(createdAt)
                .expiresAt(EXPIRES_AT)
                .status(InvitationStatus.PENDING)
                .build();
    }

    private static String cursorOfDisplayedRow(int row) {
        return row == 0 ? null : CursorCodec.encode(createdAtAndIdOf(displayed(row)));
    }

    private static Invitation displayed(int row) {
        String id = NEWEST_FIRST.get(row - 1);
        return invitations().stream().filter(invitation -> invitation.getId().equals(id)).findFirst().orElseThrow();
    }

    private static String createdAtAndIdOf(Invitation invitation) {
        Instant createdAt = invitation.getCreatedAt();
        String millis = createdAt == null ? "" : Long.toString(createdAt.toEpochMilli());
        return millis + "_" + invitation.getId();
    }

    private static List<Invitation> invitationsPast(String cursor, boolean backward, int limit) {
        Comparator<Instant> undatedFirst = Comparator.nullsFirst(Comparator.naturalOrder());
        Comparator<Invitation> oldestFirst =
                Comparator.comparing(Invitation::getCreatedAt, undatedFirst).thenComparing(Invitation::getId);
        Comparator<Invitation> displayOrder = oldestFirst.reversed();
        Comparator<Invitation> fetchOrder = backward ? oldestFirst : displayOrder;
        Optional<Invitation> anchor = Optional.ofNullable(cursor).map(InvitationServicePaginationTest::anchorOf);
        return invitations().stream()
                .sorted(fetchOrder)
                .filter(row -> anchor.map(past -> fetchOrder.compare(row, past) > 0).orElse(true))
                .limit(limit)
                .toList();
    }

    private static Invitation anchorOf(String createdAtAndId) {
        int idStart = createdAtAndId.indexOf('_');
        String millis = createdAtAndId.substring(0, idStart);
        Instant createdAt = millis.isEmpty() ? null : Instant.ofEpochMilli(Long.parseLong(millis));
        return invitation(createdAtAndId.substring(idStart + 1), createdAt);
    }

    private void stubInvitationPages() {
        when(invitationRepository.findOpenInvitationsPage(
                eq(NO_FILTER), any(Instant.class), nullable(String.class), anyBoolean(), anyInt()))
                .thenAnswer(call -> invitationsPast(call.getArgument(2), call.getArgument(3), call.getArgument(4)));
    }
}
