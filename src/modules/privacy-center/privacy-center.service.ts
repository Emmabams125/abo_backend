import { ForbiddenError } from "@/common/errors/app-error";
import { circlesRepository } from "@/modules/circles/circles.repository";
import { getCirclePrivacyEntries } from "@/modules/circles/circles.privacy";
import { getCommunityPrivacyEntries } from "@/modules/community/community.privacy";
import { getLocationPrivacyEntries } from "@/modules/location/location.privacy";
import { getSosPrivacyEntries } from "@/modules/sos/sos.privacy";
import { getReassurancePrivacyEntries } from "@/modules/reassurance/reassurance.privacy";
import { getMessagesPrivacyEntries } from "@/modules/messages/messages.privacy";
import { getUsersPrivacyEntries } from "@/modules/users/users.privacy";

/**
 * FR-PRO-04: every data-sharing feature must contribute an entry here. When a
 * new module adds a data-sharing feature, add its contributor to this list —
 * treat it as part of that module's Definition of Done, not an afterthought.
 */
const contributors = [
  (circleId: string, _userId: string) => getCirclePrivacyEntries(circleId, _userId),
  (circleId: string) => getLocationPrivacyEntries(circleId),
  () => getSosPrivacyEntries(),
  () => getReassurancePrivacyEntries(),
  () => getMessagesPrivacyEntries(),
  () => getCommunityPrivacyEntries(),
  (_circleId: string, userId: string) => getUsersPrivacyEntries(userId),
];

export const privacyCenterService = {
  /** Visible to the member themselves — including Managed Members inspecting their own visibility. */
  async getPrivacyCenter(circleId: string, userId: string) {
    const membership = await circlesRepository.findMembership(circleId, userId);
    if (!membership || membership.status !== "ACTIVE") {
      throw new ForbiddenError("You are not a member of this Circle");
    }

    const entryLists = await Promise.all(contributors.map((contributor) => contributor(circleId, userId)));
    return { circleId, userId, entries: entryLists.flat() };
  },
};
