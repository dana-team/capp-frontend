import { K8sResource, K8sCondition } from './kubernetes';

export type ScaleMetric = 'concurrency' | 'cpu' | 'memory' | 'rps';
export type CappState = 'enabled' | 'disabled';

export interface EnvVar {
  name: string;
  value: string;
}

export interface VolumeMount {
  name: string;
  mountPath: string;
}

export interface Container {
  name?: string;
  image: string;
  env?: EnvVar[];
  volumeMounts?: VolumeMount[];
}

export interface RouteSpec {
  hostname?: string;
  tlsEnabled?: boolean;
  routeTimeoutSeconds?: number;
}

export interface LogSpec {
  type: 'elastic';
  host: string;
  index: string;
  user: string;
  passwordSecret: string;
}

export interface NFSVolumeSpec {
  name: string;
  server: string;
  path: string;
  capacity: {
    storage: string;
  };
}

export interface VolumesSpec {
  nfsVolumes?: NFSVolumeSpec[];
}

export interface KafkaSource {
  name: string;
  type: 'kafka';
  bootstrapServers: string[];
  topic: string[];
}

export interface CappSpec {
  scaleMetric?: ScaleMetric;
  state?: CappState;
  configurationSpec: {
    template: {
      spec: {
        containers: Container[];
      };
    };
  };
  routeSpec?: RouteSpec;
  logSpec?: LogSpec;
  volumesSpec?: VolumesSpec;
  sources?: KafkaSource[];
}

export interface KnativeObjectStatus {
  conditions?: K8sCondition[];
}

export interface LoggingStatus {
  conditions?: K8sCondition[];
}

export interface CertificateObjectStatus {
  conditions?: K8sCondition[];
}

export interface CnameRecordObjectStatus {
  conditions?: K8sCondition[];
}

export interface DnsRecordObjectStatus {
  cnameRecordObjectStatus?: {
    conditions?: K8sCondition[];
  };
}

export interface DomainMappingObjectStatus {
  conditions?: K8sCondition[];
}

export interface RouteStatus {
  certificateObjectStatus?: CertificateObjectStatus;
  dnsRecordObjectStatus?: DnsRecordObjectStatus;
  domainMappingObjectStatus?: DomainMappingObjectStatus;
}

export interface CappStatus {
  knativeObjectStatus?: KnativeObjectStatus;
  loggingStatus?: LoggingStatus;
  routeStatus?: RouteStatus;
}

export type Capp = K8sResource<CappSpec, CappStatus>;

export interface FlatCondition {
  source: string;
  type: string;
  status: 'True' | 'False' | 'Unknown';
  lastTransitionTime?: string;
  reason?: string;
  message?: string;
}
