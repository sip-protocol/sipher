# EncryptIncoValueRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Plaintext** | [**EncryptIncoValueRequestPlaintext**](EncryptIncoValueRequestPlaintext.md) |  | 
**Scheme** | **string** | FHE scheme to use | 
**Label** | Pointer to **string** | Optional label for the encryption | [optional] 

## Methods

### NewEncryptIncoValueRequest

`func NewEncryptIncoValueRequest(plaintext EncryptIncoValueRequestPlaintext, scheme string, ) *EncryptIncoValueRequest`

NewEncryptIncoValueRequest instantiates a new EncryptIncoValueRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewEncryptIncoValueRequestWithDefaults

`func NewEncryptIncoValueRequestWithDefaults() *EncryptIncoValueRequest`

NewEncryptIncoValueRequestWithDefaults instantiates a new EncryptIncoValueRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetPlaintext

`func (o *EncryptIncoValueRequest) GetPlaintext() EncryptIncoValueRequestPlaintext`

GetPlaintext returns the Plaintext field if non-nil, zero value otherwise.

### GetPlaintextOk

`func (o *EncryptIncoValueRequest) GetPlaintextOk() (*EncryptIncoValueRequestPlaintext, bool)`

GetPlaintextOk returns a tuple with the Plaintext field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetPlaintext

`func (o *EncryptIncoValueRequest) SetPlaintext(v EncryptIncoValueRequestPlaintext)`

SetPlaintext sets Plaintext field to given value.


### GetScheme

`func (o *EncryptIncoValueRequest) GetScheme() string`

GetScheme returns the Scheme field if non-nil, zero value otherwise.

### GetSchemeOk

`func (o *EncryptIncoValueRequest) GetSchemeOk() (*string, bool)`

GetSchemeOk returns a tuple with the Scheme field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetScheme

`func (o *EncryptIncoValueRequest) SetScheme(v string)`

SetScheme sets Scheme field to given value.


### GetLabel

`func (o *EncryptIncoValueRequest) GetLabel() string`

GetLabel returns the Label field if non-nil, zero value otherwise.

### GetLabelOk

`func (o *EncryptIncoValueRequest) GetLabelOk() (*string, bool)`

GetLabelOk returns a tuple with the Label field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetLabel

`func (o *EncryptIncoValueRequest) SetLabel(v string)`

SetLabel sets Label field to given value.

### HasLabel

`func (o *EncryptIncoValueRequest) HasLabel() bool`

HasLabel returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


