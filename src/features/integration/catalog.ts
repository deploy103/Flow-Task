import { OrganizationIntegrationKind } from "@prisma/client";

type IntegrationGuide = {
  title: string;
  shortDescription: string;
  purpose: string;
  endpointLabel: string;
  endpointPlaceholder: string;
  endpointHelp: string;
  steps: readonly string[];
  usesSecret: boolean;
  recommended?: boolean;
};

export const INTEGRATION_GUIDES: Record<OrganizationIntegrationKind, IntegrationGuide> = {
  [OrganizationIntegrationKind.DISCORD_WEBHOOK]: {
    title: "Discord 채널 알림",
    shortDescription: "Discord 채널에 Flow Task 알림을 보냅니다.",
    purpose: "팀이 Discord를 사용하고, 공지·과제 알림을 한 채널에서 받고 싶을 때 선택하세요.",
    endpointLabel: "Discord Webhook URL",
    endpointPlaceholder: "https://discord.com/api/webhooks/...",
    endpointHelp: "Discord에서 복사한 Webhook URL 전체를 붙여넣으세요. Discord 비밀번호는 입력하지 않습니다.",
    steps: [
      "Discord 서버의 서버 설정 → 연동 → Webhook을 엽니다.",
      "새 Webhook을 만들고 알림을 받을 채널을 선택합니다.",
      "Webhook URL 복사를 누른 뒤 아래 입력칸에 붙여넣습니다.",
    ],
    usesSecret: false,
    recommended: true,
  },
  [OrganizationIntegrationKind.GENERIC_WEBHOOK]: {
    title: "다른 서비스로 알림 보내기",
    shortDescription: "Slack, Mattermost 등의 HTTPS 알림 주소를 사용합니다.",
    purpose: "Discord가 아닌 서비스가 Webhook 주소를 제공할 때 선택하세요. 연동 전 서버 관리자의 허용이 필요합니다.",
    endpointLabel: "서비스가 제공한 Webhook URL",
    endpointPlaceholder: "https://hooks.example.com/flow-task",
    endpointHelp: "HTTPS로 시작하는 주소만 사용할 수 있습니다. 목록에 없는 호스트라면 서버 관리자에게 허용을 요청하세요.",
    steps: [
      "연동할 서비스에서 수신 Webhook URL을 발급합니다.",
      "해당 URL의 호스트가 아래 '서버가 허용한 주소'에 있는지 확인합니다.",
      "서비스가 Bearer 토큰을 제공한 경우에만 비밀 토큰을 함께 입력합니다.",
    ],
    usesSecret: true,
  },
  [OrganizationIntegrationKind.EMAIL_RELAY]: {
    title: "사내 이메일 발송 API",
    shortDescription: "조직이 관리하는 이메일 발송 API로 알림을 보냅니다.",
    purpose: "이메일 발송 업체나 사내 서버의 전용 API URL과 토큰을 이미 발급받은 경우에 선택하세요.",
    endpointLabel: "이메일 발송 API URL",
    endpointPlaceholder: "https://mail.example.com/v1/send",
    endpointHelp: "일반 이메일 주소가 아니라 관리자가 제공한 HTTPS API URL을 입력하세요.",
    steps: [
      "이메일 시스템 관리자에게 발송 API URL과 Bearer 토큰을 요청합니다.",
      "API URL의 호스트가 아래 '서버가 허용한 주소'에 있는지 확인합니다.",
      "URL과 비밀 토큰을 입력합니다. 저장한 토큰은 다시 표시되지 않습니다.",
    ],
    usesSecret: true,
  },
};

export function parseIntegrationKind(value: string | undefined) {
  return Object.values(OrganizationIntegrationKind).find((kind) => kind === value) ?? null;
}

export const INTEGRATION_ERROR_MESSAGES: Record<string, string> = {
  invalid_input: "입력한 값을 확인해 주세요. 이름과 HTTPS 주소는 필수입니다.",
  server_configuration: "서버의 연동 보안 설정이 아직 준비되지 않았습니다. 서버 관리자에게 문의해 주세요.",
  invalid_endpoint: "주소를 사용할 수 없습니다. HTTPS 주소와 허용된 호스트인지 확인해 주세요.",
  duplicate: "같은 종류와 이름의 연동이 이미 있습니다. 다른 표시 이름을 사용해 주세요.",
  create_failed: "연동을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  delete_failed: "연동을 삭제하지 못했습니다. 이미 삭제됐는지 확인해 주세요.",
};
