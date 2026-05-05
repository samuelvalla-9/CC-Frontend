export enum NotificationStatus {
  READ = 'READ',
  UNREAD = 'UNREAD'
}

export enum NotificationCategory {
  EMERGENCY = 'EMERGENCY',
  TREATMENT = 'TREATMENT',
  FACILITY = 'FACILITY',
  COMPLIANCE = 'COMPLIANCE',
  SYSTEM = 'SYSTEM'
}

export interface Notification {
  notificationId: number;
  userId: number;
  entityId: number;
  message: string;
  category: NotificationCategory;
  status: NotificationStatus;
  createdDate: string;
  readDate?: string;
  type?: string;
}

export interface NotificationRequest {
  userId: number;
  entityId: number;
  message: string;
  category: NotificationCategory;
}
