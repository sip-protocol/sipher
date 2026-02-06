# SubmitArciumComputationRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**CircuitId** | **string** | Circuit identifier | 
**EncryptedInputs** | **[]string** | Encrypted inputs as hex strings | 
**Chain** | Pointer to **string** | Target chain | [optional] [default to "solana"]
**Cipher** | Pointer to **string** |  | [optional] [default to "aes256"]
**ViewingKey** | Pointer to [**SubmitArciumComputationRequestViewingKey**](SubmitArciumComputationRequestViewingKey.md) |  | [optional] 
**Cluster** | Pointer to **string** | MPC cluster to use | [optional] 
**Timeout** | Pointer to **int32** | Timeout in milliseconds | [optional] 

## Methods

### NewSubmitArciumComputationRequest

`func NewSubmitArciumComputationRequest(circuitId string, encryptedInputs []string, ) *SubmitArciumComputationRequest`

NewSubmitArciumComputationRequest instantiates a new SubmitArciumComputationRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewSubmitArciumComputationRequestWithDefaults

`func NewSubmitArciumComputationRequestWithDefaults() *SubmitArciumComputationRequest`

NewSubmitArciumComputationRequestWithDefaults instantiates a new SubmitArciumComputationRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetCircuitId

`func (o *SubmitArciumComputationRequest) GetCircuitId() string`

GetCircuitId returns the CircuitId field if non-nil, zero value otherwise.

### GetCircuitIdOk

`func (o *SubmitArciumComputationRequest) GetCircuitIdOk() (*string, bool)`

GetCircuitIdOk returns a tuple with the CircuitId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetCircuitId

`func (o *SubmitArciumComputationRequest) SetCircuitId(v string)`

SetCircuitId sets CircuitId field to given value.


### GetEncryptedInputs

`func (o *SubmitArciumComputationRequest) GetEncryptedInputs() []string`

GetEncryptedInputs returns the EncryptedInputs field if non-nil, zero value otherwise.

### GetEncryptedInputsOk

`func (o *SubmitArciumComputationRequest) GetEncryptedInputsOk() (*[]string, bool)`

GetEncryptedInputsOk returns a tuple with the EncryptedInputs field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetEncryptedInputs

`func (o *SubmitArciumComputationRequest) SetEncryptedInputs(v []string)`

SetEncryptedInputs sets EncryptedInputs field to given value.


### GetChain

`func (o *SubmitArciumComputationRequest) GetChain() string`

GetChain returns the Chain field if non-nil, zero value otherwise.

### GetChainOk

`func (o *SubmitArciumComputationRequest) GetChainOk() (*string, bool)`

GetChainOk returns a tuple with the Chain field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetChain

`func (o *SubmitArciumComputationRequest) SetChain(v string)`

SetChain sets Chain field to given value.

### HasChain

`func (o *SubmitArciumComputationRequest) HasChain() bool`

HasChain returns a boolean if a field has been set.

### GetCipher

`func (o *SubmitArciumComputationRequest) GetCipher() string`

GetCipher returns the Cipher field if non-nil, zero value otherwise.

### GetCipherOk

`func (o *SubmitArciumComputationRequest) GetCipherOk() (*string, bool)`

GetCipherOk returns a tuple with the Cipher field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetCipher

`func (o *SubmitArciumComputationRequest) SetCipher(v string)`

SetCipher sets Cipher field to given value.

### HasCipher

`func (o *SubmitArciumComputationRequest) HasCipher() bool`

HasCipher returns a boolean if a field has been set.

### GetViewingKey

`func (o *SubmitArciumComputationRequest) GetViewingKey() SubmitArciumComputationRequestViewingKey`

GetViewingKey returns the ViewingKey field if non-nil, zero value otherwise.

### GetViewingKeyOk

`func (o *SubmitArciumComputationRequest) GetViewingKeyOk() (*SubmitArciumComputationRequestViewingKey, bool)`

GetViewingKeyOk returns a tuple with the ViewingKey field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetViewingKey

`func (o *SubmitArciumComputationRequest) SetViewingKey(v SubmitArciumComputationRequestViewingKey)`

SetViewingKey sets ViewingKey field to given value.

### HasViewingKey

`func (o *SubmitArciumComputationRequest) HasViewingKey() bool`

HasViewingKey returns a boolean if a field has been set.

### GetCluster

`func (o *SubmitArciumComputationRequest) GetCluster() string`

GetCluster returns the Cluster field if non-nil, zero value otherwise.

### GetClusterOk

`func (o *SubmitArciumComputationRequest) GetClusterOk() (*string, bool)`

GetClusterOk returns a tuple with the Cluster field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetCluster

`func (o *SubmitArciumComputationRequest) SetCluster(v string)`

SetCluster sets Cluster field to given value.

### HasCluster

`func (o *SubmitArciumComputationRequest) HasCluster() bool`

HasCluster returns a boolean if a field has been set.

### GetTimeout

`func (o *SubmitArciumComputationRequest) GetTimeout() int32`

GetTimeout returns the Timeout field if non-nil, zero value otherwise.

### GetTimeoutOk

`func (o *SubmitArciumComputationRequest) GetTimeoutOk() (*int32, bool)`

GetTimeoutOk returns a tuple with the Timeout field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetTimeout

`func (o *SubmitArciumComputationRequest) SetTimeout(v int32)`

SetTimeout sets Timeout field to given value.

### HasTimeout

`func (o *SubmitArciumComputationRequest) HasTimeout() bool`

HasTimeout returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


