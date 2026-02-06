# ScanPaymentsBatchRequestKeyPairsInner

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**ViewingPrivateKey** | **string** | 0x-prefixed 32-byte hex string | 
**SpendingPublicKey** | **string** | 0x-prefixed 32-byte hex string | 
**Label** | Pointer to **string** |  | [optional] 

## Methods

### NewScanPaymentsBatchRequestKeyPairsInner

`func NewScanPaymentsBatchRequestKeyPairsInner(viewingPrivateKey string, spendingPublicKey string, ) *ScanPaymentsBatchRequestKeyPairsInner`

NewScanPaymentsBatchRequestKeyPairsInner instantiates a new ScanPaymentsBatchRequestKeyPairsInner object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewScanPaymentsBatchRequestKeyPairsInnerWithDefaults

`func NewScanPaymentsBatchRequestKeyPairsInnerWithDefaults() *ScanPaymentsBatchRequestKeyPairsInner`

NewScanPaymentsBatchRequestKeyPairsInnerWithDefaults instantiates a new ScanPaymentsBatchRequestKeyPairsInner object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetViewingPrivateKey

`func (o *ScanPaymentsBatchRequestKeyPairsInner) GetViewingPrivateKey() string`

GetViewingPrivateKey returns the ViewingPrivateKey field if non-nil, zero value otherwise.

### GetViewingPrivateKeyOk

`func (o *ScanPaymentsBatchRequestKeyPairsInner) GetViewingPrivateKeyOk() (*string, bool)`

GetViewingPrivateKeyOk returns a tuple with the ViewingPrivateKey field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetViewingPrivateKey

`func (o *ScanPaymentsBatchRequestKeyPairsInner) SetViewingPrivateKey(v string)`

SetViewingPrivateKey sets ViewingPrivateKey field to given value.


### GetSpendingPublicKey

`func (o *ScanPaymentsBatchRequestKeyPairsInner) GetSpendingPublicKey() string`

GetSpendingPublicKey returns the SpendingPublicKey field if non-nil, zero value otherwise.

### GetSpendingPublicKeyOk

`func (o *ScanPaymentsBatchRequestKeyPairsInner) GetSpendingPublicKeyOk() (*string, bool)`

GetSpendingPublicKeyOk returns a tuple with the SpendingPublicKey field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSpendingPublicKey

`func (o *ScanPaymentsBatchRequestKeyPairsInner) SetSpendingPublicKey(v string)`

SetSpendingPublicKey sets SpendingPublicKey field to given value.


### GetLabel

`func (o *ScanPaymentsBatchRequestKeyPairsInner) GetLabel() string`

GetLabel returns the Label field if non-nil, zero value otherwise.

### GetLabelOk

`func (o *ScanPaymentsBatchRequestKeyPairsInner) GetLabelOk() (*string, bool)`

GetLabelOk returns a tuple with the Label field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetLabel

`func (o *ScanPaymentsBatchRequestKeyPairsInner) SetLabel(v string)`

SetLabel sets Label field to given value.

### HasLabel

`func (o *ScanPaymentsBatchRequestKeyPairsInner) HasLabel() bool`

HasLabel returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


