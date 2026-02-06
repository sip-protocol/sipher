# ScanPaymentsRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**ViewingPrivateKey** | **string** | 0x-prefixed 32-byte hex string | 
**SpendingPublicKey** | **string** | 0x-prefixed 32-byte hex string | 
**FromSlot** | Pointer to **int32** |  | [optional] 
**ToSlot** | Pointer to **int32** |  | [optional] 
**Limit** | Pointer to **int32** |  | [optional] [default to 100]

## Methods

### NewScanPaymentsRequest

`func NewScanPaymentsRequest(viewingPrivateKey string, spendingPublicKey string, ) *ScanPaymentsRequest`

NewScanPaymentsRequest instantiates a new ScanPaymentsRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewScanPaymentsRequestWithDefaults

`func NewScanPaymentsRequestWithDefaults() *ScanPaymentsRequest`

NewScanPaymentsRequestWithDefaults instantiates a new ScanPaymentsRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetViewingPrivateKey

`func (o *ScanPaymentsRequest) GetViewingPrivateKey() string`

GetViewingPrivateKey returns the ViewingPrivateKey field if non-nil, zero value otherwise.

### GetViewingPrivateKeyOk

`func (o *ScanPaymentsRequest) GetViewingPrivateKeyOk() (*string, bool)`

GetViewingPrivateKeyOk returns a tuple with the ViewingPrivateKey field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetViewingPrivateKey

`func (o *ScanPaymentsRequest) SetViewingPrivateKey(v string)`

SetViewingPrivateKey sets ViewingPrivateKey field to given value.


### GetSpendingPublicKey

`func (o *ScanPaymentsRequest) GetSpendingPublicKey() string`

GetSpendingPublicKey returns the SpendingPublicKey field if non-nil, zero value otherwise.

### GetSpendingPublicKeyOk

`func (o *ScanPaymentsRequest) GetSpendingPublicKeyOk() (*string, bool)`

GetSpendingPublicKeyOk returns a tuple with the SpendingPublicKey field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSpendingPublicKey

`func (o *ScanPaymentsRequest) SetSpendingPublicKey(v string)`

SetSpendingPublicKey sets SpendingPublicKey field to given value.


### GetFromSlot

`func (o *ScanPaymentsRequest) GetFromSlot() int32`

GetFromSlot returns the FromSlot field if non-nil, zero value otherwise.

### GetFromSlotOk

`func (o *ScanPaymentsRequest) GetFromSlotOk() (*int32, bool)`

GetFromSlotOk returns a tuple with the FromSlot field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetFromSlot

`func (o *ScanPaymentsRequest) SetFromSlot(v int32)`

SetFromSlot sets FromSlot field to given value.

### HasFromSlot

`func (o *ScanPaymentsRequest) HasFromSlot() bool`

HasFromSlot returns a boolean if a field has been set.

### GetToSlot

`func (o *ScanPaymentsRequest) GetToSlot() int32`

GetToSlot returns the ToSlot field if non-nil, zero value otherwise.

### GetToSlotOk

`func (o *ScanPaymentsRequest) GetToSlotOk() (*int32, bool)`

GetToSlotOk returns a tuple with the ToSlot field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetToSlot

`func (o *ScanPaymentsRequest) SetToSlot(v int32)`

SetToSlot sets ToSlot field to given value.

### HasToSlot

`func (o *ScanPaymentsRequest) HasToSlot() bool`

HasToSlot returns a boolean if a field has been set.

### GetLimit

`func (o *ScanPaymentsRequest) GetLimit() int32`

GetLimit returns the Limit field if non-nil, zero value otherwise.

### GetLimitOk

`func (o *ScanPaymentsRequest) GetLimitOk() (*int32, bool)`

GetLimitOk returns a tuple with the Limit field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetLimit

`func (o *ScanPaymentsRequest) SetLimit(v int32)`

SetLimit sets Limit field to given value.

### HasLimit

`func (o *ScanPaymentsRequest) HasLimit() bool`

HasLimit returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


